const db = require("../db/index");

const lobbyDB = require("../db/lobby");
const lobbyPlayerDB = require("../db/lobbyPlayer");
const lobbyTierDB = require("../db/lobbyTier");
const guildDB = require("../db/guild");
const playerDB = require("../db/player");
const tierDB = require("../db/tier");

const canSearchTier = (playerTier, targetTier) => {
  // Compares two tiers, and returns true if someone
  // from playerTier can play in targetTier
  if (!playerTier || !targetTier) return false;
  return targetTier.weight == null || targetTier.weight >= playerTier.weight;
};

const matchNotAccepted = async (declinePlayer, isTimeout) => {
  // Handles a match not being accepted, whether by direct 'Decline' or timeout.

  const lobby = await lobbyDB.getByPlayerStatus(
    declinePlayer.id,
    "CONFIRMATION",
    false
  );

  const guildId = lobby.guild_id;
  const guild = await guildDB.get(guildId, false);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Get all tier messages
    const allMessages = await lobbyTierDB.getAllMessages(lobby.id, client);

    // Get all players
    const allPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id, client);
    const otherPlayers = allPlayers.filter(
      (player) => player.player_id !== declinePlayer.id
    );

    const otherPlayerIds = otherPlayers.map((player) => player.player_id);

    // Update their lobbies status
    for (otherPlayerId of otherPlayerIds) {
      const playerLobby = await lobbyDB.getByPlayer(
        otherPlayerId,
        false,
        client
      );
      await lobbyDB.updateStatus(playerLobby.id, "SEARCHING", client);
      await lobbyPlayerDB.updateStatus(
        playerLobby.id,
        otherPlayerId,
        "SEARCHING",
        client
      );
    }

    // Remove Lobby Players
    await lobbyPlayerDB.removeOtherPlayers(lobby.id, lobby.created_by, client);

    // Remove / AFK the lobby
    if (isTimeout) {
      const afkLobby = await lobbyDB.getByPlayer(
        declinePlayer.id,
        false,
        client
      );
      await lobbyDB.updateStatus(afkLobby.id, "AFK", client);
      await lobbyPlayerDB.updateAllStatus(afkLobby.id, "AFK", client);
    } else await lobbyDB.removeByPlayer(declinePlayer.id, false, client);
    await client.query("COMMIT");

    return {
      declined: allPlayers.filter(
        (info) => info.player_id === declinePlayer.id
      ),
      others: otherPlayers,
      messagesInfo: allMessages,
      guild: guild.discord_id,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

// PUBLIC WITH INTERNAL DATA

const matchmaking = async (playerId, lobbyId, targetTierId = null) => {
  const opponent = await lobbyDB.matchmaking(lobbyId, targetTierId);
  if (!opponent) return null;

  const { player_id: rivalPlayerId, lobby_id: rivalLobbyId } = opponent;

  const client = await db.getClient();

  // Update status
  try {
    await client.query("BEGIN");
    await lobbyDB.updateStatus(lobbyId, "CONFIRMATION", client);
    await lobbyDB.updateStatus(rivalLobbyId, "WAITING", client);
    await lobbyPlayerDB.updateStatus(lobbyId, playerId, "CONFIRMATION", client);
    await lobbyPlayerDB.insert(lobbyId, rivalPlayerId, "CONFIRMATION", client);
    await client.query("COMMIT");

    return await playerDB.get(rivalPlayerId, false);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

// PUBLIC

const getByPlayer = async (playerDiscordId) => {
  return await lobbyDB.getByPlayer(playerDiscordId, true);
};

const getGuild = async (lobbyId) => {
  return await guildDB.getByLobby(lobbyId);
};

const search = async (playerDiscordId, guildDiscordId, messageDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  if (!guild) throw { name: "GUILD_NOT_FOUND" };

  const player = await playerDB.get(playerDiscordId, true);
  if (!player) throw { name: "PLAYER_NOT_FOUND" };

  const targetTier = await tierDB.getByMessage(messageDiscordId);
  if (!targetTier) throw { name: "TIER_NOT_FOUND" };

  const playerTier = await playerDB.getTier(player.id);
  const canSearch = canSearchTier(playerTier, targetTier);

  if (!canSearch)
    throw {
      name: "TOO_NOOB",
      args: {
        targetTier: targetTier.discord_id,
        playerTier: playerTier.discord_id,
      },
    };

  let lobby = await lobbyDB.getByPlayer(player.id);
  const isSearching = lobby?.status === "SEARCHING";
  const hasTier = await lobbyDB.hasTier(lobby?.id, targetTier.id);

  if (!lobby) {
    await lobbyDB.create(guild.id, player.id, targetTier.id);
    lobby = await lobbyDB.getByPlayer(player.id);
  } else if (!isSearching) {
    throw { name: "NOT_SEARCHING" };
  } else if (hasTier) {
    throw {
      name: "ALREADY_SEARCHING",
      args: { targetTier: targetTier.discord_id },
    };
  } else await lobbyDB.addTier(lobby.id, targetTier.id);

  const rivalPlayer = await matchmaking(player.id, lobby.id, targetTier.id);

  // Unmatched, return info to send @Tier
  if (!rivalPlayer) {
    return {
      matched: false,
      tierId: targetTier.discord_id,
      channelId: targetTier.channel_id,
    };
  }

  return {
    matched: true,
    players: [player.discord_id, rivalPlayer.discord_id],
  };
};

const stopSearch = async (playerDiscordId, messageId) => {
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);
  const tier = await tierDB.getByMessage(messageId);

  //  Checks
  if (!lobby) throw { name: "LOBBY_NOT_FOUND" };
  if (!tier) throw { name: "TIER_NOT_FOUND" };

  let hasTier = await lobbyDB.hasTier(lobby.id, tier.id);
  if (!hasTier)
    throw { name: "NOT_SEARCHING_HERE", args: { tierId: tier.discord_id } };

  if (lobby.status === "PLAYING") throw { name: "ALREADY_PLAYING" };
  if (lobby.status === "CONFIRMATION" || lobby.status === "WAITING")
    throw { name: "ALREADY_CONFIRMATION" };

  // Remove Tier
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    const lobbyTier = await lobbyTierDB.get(lobby.id, tier.id, client);
    await lobbyTierDB.remove(lobby.id, tier.id, client);

    // If it was the last tier, remove the lobby
    hasTier = await lobbyTierDB.hasAnyTier(lobby.id, client);
    if (!hasTier) await lobbyDB.remove(lobby.id, false, client);
    await client.query("COMMIT");

    return {
      isSearching: hasTier,
      tierId: tier.discord_id,
      channelId: tier.channel_id,
      messageId: lobbyTier.message_id,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const saveDirectMessage = async (playerDiscordId, messageId) => {
  const player = await playerDB.get(playerDiscordId, true);
  if (!player) throw { name: "PLAYER_NOT_FOUND" };

  await lobbyPlayerDB.setMessage(player.id, messageId);
  return true;
};

const getTierMessages = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  if (!player) throw { name: "PLAYER_NOT_FOUND" };

  const matchedLobby = await lobbyDB.getByPlayerStatus(
    player.id,
    "CONFIRMATION",
    false
  );

  const tierData = await lobbyTierDB.getAllMessages(matchedLobby.id);
  if (!tierData) throw { name: "MESSAGES_NOT_FOUND" };

  return tierData.map((data) => {
    return {
      authorId: data.player_id,
      channelId: data.channel_id,
      messageId: data.message_id,
      tierId: data.discord_id,
    };
  });
};

const getTierChannels = async (playerDiscordId) => {
  // Given a player, returns all the channels where he's looking for games
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);
  const channelsInfo = await lobbyTierDB.getChannels(lobby.id);

  return channelsInfo;
};

const saveSearchTierMessage = async (
  playerDiscordId,
  tierDiscordId,
  messageId
) => {
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);
  const tier = await tierDB.get(tierDiscordId, true);
  await lobbyTierDB.updateMessage(lobby.id, tier.id, messageId);
  return true;
};

const acceptMatch = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(
    player.id,
    "CONFIRMATION",
    false
  );

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await lobbyPlayerDB.updateStatus(lobby.id, player.id, "ACCEPTED", client);
    const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id, client);
    await client.query("COMMIT");

    return lobbyPlayers;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const timeoutMatch = async (playerDiscordId) => {
  const acceptedPlayer = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(
    acceptedPlayer.id,
    "CONFIRMATION",
    false
  );

  const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id);
  const rejectedPlayers = lobbyPlayers.filter(
    (player) => player.status != "ACCEPTED"
  );

  const rejectedPlayer = await playerDB.get(
    rejectedPlayers[0].player_id,
    false
  );

  return await matchNotAccepted(rejectedPlayer, true);
};

const declineMatch = async (playerDiscordId) => {
  const declinePlayer = await playerDB.get(playerDiscordId, true);
  return await matchNotAccepted(declinePlayer, false);
};

const afterConfirmation = async (
  playerDiscordId,
  textChannelId,
  voiceChannelId
) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const lobby = await lobbyDB.getByPlayerStatus(
      playerDiscordId,
      "CONFIRMATION",
      true,
      client
    );
    await lobbyDB.updateLobbyChannels(
      lobby.id,
      textChannelId,
      voiceChannelId,
      client
    );
    const allMessages = await lobbyTierDB.getAllMessages(lobby.id, client);
    await lobbyDB.removeOtherLobbies(lobby.id, client);
    await lobbyDB.updateStatus(lobby.id, "PLAYING", client);
    await lobbyPlayerDB.updateAllStatus(lobby.id, "PLAYING", client);
    await lobbyDB.removeOtherLobbies(lobby.id, client);

    const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id, client);
    await client.query("COMMIT");

    return { messages: allMessages, players: lobbyPlayers };
  } catch (e) {
    client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const unAFK = async (playerDiscordId) => {
  // Removes the status of "AFK" to the lobby, and starts searching again
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayer(player.id, false);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await lobbyPlayerDB.updateStatus(lobby.id, player.id, "SEARCHING", client);
    await lobbyDB.updateStatus(lobby.id, "SEARCHING");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const rivalPlayer = await matchmaking(player.id, lobby.id);
  const guild = await guildDB.get(lobby.guild_id, false);

  return { rival: rivalPlayer, guild: guild.discord_id };
};

module.exports = {
  getByPlayer,
  getGuild,
  search,
  stopSearch,
  saveSearchTierMessage,
  saveDirectMessage,
  getTierMessages,
  getTierChannels,
  acceptMatch,
  declineMatch,
  timeoutMatch,
  afterConfirmation,
  matchmaking,
  unAFK,
};
