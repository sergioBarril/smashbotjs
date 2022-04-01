const db = require("../db/index");

const lobbyDB = require("../db/lobby");
const lobbyPlayerDB = require("../db/lobbyPlayer");
const lobbyTierDB = require("../db/lobbyTier");
const lobbyMessageDB = require("../db/lobbyMessage");
const guildDB = require("../db/guild");
const playerDB = require("../db/player");
const tierDB = require("../db/tier");
const yuzuPlayerDB = require("../db/yuzuPlayer");
const gameSetDB = require("../db/gameSet");
const ratingDB = require("../db/rating");

const canSearchTier = (playerTier, targetTier) => {
  // Compares two tiers, and returns true if someone
  // from playerTier can play in targetTier
  if (!playerTier || !targetTier) return false;
  return targetTier.weight == null || targetTier.weight >= playerTier.weight;
};

const matchNotAccepted = async (declinePlayer, isTimeout) => {
  // Handles a match not being accepted, whether by direct 'Decline' or timeout.

  const lobby = await lobbyDB.getByPlayerStatus(declinePlayer.id, "CONFIRMATION", false);

  const guildId = lobby.guild_id;
  const guild = await guildDB.get(guildId, false);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Get all tier messages
    const allMessages = await lobbyTierDB.getAllMessages(lobby.id, client);

    // Get all players
    const allPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id, client);
    const otherPlayers = allPlayers.filter((player) => player.player_id !== declinePlayer.id);

    const otherPlayerIds = otherPlayers.map((player) => player.player_id);

    // Update their lobbies status
    for (otherPlayerId of otherPlayerIds) {
      const playerLobby = await lobbyDB.getByPlayer(otherPlayerId, false, client);

      const hasTier = await lobbyTierDB.hasAnyTier(playerLobby.id, client);
      if (!hasTier) await lobbyDB.remove(playerLobby.id, false, client);
      else {
        await lobbyDB.updateStatus(playerLobby.id, "SEARCHING", client);
        await lobbyPlayerDB.updateStatus(playerLobby.id, otherPlayerId, "SEARCHING", client);
      }
    }

    // Remove Lobby Players
    await lobbyPlayerDB.removeOtherPlayers(lobby.id, lobby.created_by, client);

    // Remove / AFK the lobby
    if (isTimeout) {
      const afkLobby = await lobbyDB.getByPlayer(declinePlayer.id, false, client);
      const hasAnyTier = await lobbyTierDB.hasAnyTier(afkLobby.id);

      if (hasAnyTier) {
        await lobbyDB.updateStatus(afkLobby.id, "AFK", client);
        await lobbyTierDB.clearMessages(afkLobby.id, client);
        await lobbyPlayerDB.updateAllStatus(afkLobby.id, "AFK", client);
      } else await lobbyDB.removeByPlayer(declinePlayer.id, false, client);
    } else await lobbyDB.removeByPlayer(declinePlayer.id, false, client);
    await client.query("COMMIT");

    return {
      declined: allPlayers.filter((info) => info.player_id === declinePlayer.id),
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

const matchmaking = async (playerId, lobbyId, guildId, targetTierId = null, opponent = null) => {
  if (opponent === null) opponent = await lobbyDB.matchmaking(lobbyId, guildId, targetTierId);
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

const hasLobbyTiers = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayer(player.id, false);

  if (!lobby) return false;
  const hasAnyTier = await lobbyTierDB.hasAnyTier(lobby.id);

  return hasAnyTier;
};

const canSearchYuzu = async (playerId, guildId) => {
  const yuzuPlayer = await yuzuPlayerDB.get(playerId, guildId);

  return yuzuPlayer && (yuzuPlayer.yuzu || yuzuPlayer.parsec);
};

const canSearchRanked = async (playerId, guildId) => {
  const rating = await ratingDB.getByPlayerGuild(playerId, guildId);
  return rating?.tier_id != null;
};

const rankedSearch = async (playerDiscordId, guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  if (!guild) throw { name: "GUILD_NOT_FOUND" };

  const player = await playerDB.get(playerDiscordId, true);
  if (!player) throw { name: "PLAYER_NOT_FOUND" };

  const canSearch = await canSearchRanked(player.id, guild.id);
  if (!canSearch) throw { name: "NO_LAN_TIER" };

  let lobby = await lobbyDB.getByPlayer(player.id);
  const existsLobbyPlayer = await lobbyPlayerDB.existsLobbyPlayer(player.id);
  const isSearching = lobby?.status === "SEARCHING";

  if (!lobby && !existsLobbyPlayer) {
    await lobbyDB.createRanked(guild.id, player.id);
    lobby = await lobbyDB.getByPlayer(player.id);
  } else if (!isSearching || (!lobby && existsLobbyPlayer)) {
    throw { name: "NOT_SEARCHING" };
  } else if (lobby.ranked) {
    throw { name: "ALREADY_SEARCHING" };
  } else await lobbyDB.setRanked(lobby.id, true);

  return true;
};

const search = async (playerDiscordId, guildDiscordId, messageDiscordId) => {
  const isSearchAll = messageDiscordId === null;

  const guild = await guildDB.get(guildDiscordId, true);
  if (!guild) throw { name: "GUILD_NOT_FOUND" };

  const player = await playerDB.get(playerDiscordId, true);
  if (!player) throw { name: "PLAYER_NOT_FOUND" };

  const targetTier = await tierDB.getBySearchMessage(messageDiscordId);
  if (!targetTier && !isSearchAll) throw { name: "TIER_NOT_FOUND" };

  const isYuzu = !isSearchAll && targetTier.yuzu;

  let targetTiers = [];
  const allTiers = await tierDB.getByGuild(guild.id, false);

  const playerTier = await playerDB.getTier(player.id, guild.id);
  // Yuzu
  if (isYuzu) {
    const canSearch = await canSearchYuzu(player.id, guild.id);
    if (!canSearch)
      throw {
        name: "NO_YUZU",
        args: {
          yuzuRole: guild.yuzu_role_id,
          parsecRole: guild.parsec_role_id,
        },
      };
    else targetTiers.push(targetTier);

    // Not yuzu
  } else {
    let canSearch = false;
    // One tier
    if (targetTier && canSearchTier(playerTier, targetTier)) {
      targetTiers.push(targetTier);
      canSearch = true;
    }
    // All tiers
    else if (isSearchAll) {
      targetTiers = allTiers.filter(
        (tier) => tier.weight !== null && canSearchTier(playerTier, tier)
      );
      canSearch = targetTiers.length > 0;
    }

    if (!canSearch && targetTier)
      throw {
        name: "TOO_NOOB",
        args: {
          targetTier: targetTier.discord_id,
          playerTier: playerTier.discord_id,
        },
      };
    else if (!canSearch)
      throw {
        name: "NO_CABLE",
      };
  }

  let lobby = await lobbyDB.getByPlayer(player.id);
  const existsLobbyPlayer = await lobbyPlayerDB.existsLobbyPlayer(player.id);
  const isSearching = lobby?.status === "SEARCHING";
  const searchingTiers = await lobbyTierDB.getByLobby(lobby?.id);
  const searchingTiersIds = searchingTiers.map((tier) => tier.id);

  // Is already searching all those tiers?
  const newTiers = targetTiers.filter((tier) => !searchingTiersIds.includes(tier.id));

  if (!lobby && !existsLobbyPlayer) {
    await lobbyDB.create(guild.id, player.id, targetTiers);
    lobby = await lobbyDB.getByPlayer(player.id);
  } else if (!isSearching || (!lobby && existsLobbyPlayer)) {
    throw { name: "NOT_SEARCHING" };
  } else if (newTiers.length === 0) {
    throw {
      name: "ALREADY_SEARCHING",
      args: { targetTiers, isYuzu },
    };
  } else await lobbyDB.addTiers(lobby.id, newTiers);

  const rivalPlayer = await matchmaking(player.id, lobby.id, guild.id, null);

  // Unmatched, return info to send @Tier
  if (!rivalPlayer) {
    return {
      matched: false,
      tiers: targetTiers,
    };
  }

  return {
    matched: true,
    players: [player.discord_id, rivalPlayer.discord_id],
  };
};

const directMatch = async (playerDiscordId, guildDiscordId, messageDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  if (!guild) throw { name: "GUILD_NOT_FOUND" };

  const newPlayer = await playerDB.get(playerDiscordId, true);
  if (!newPlayer) throw { name: "PLAYER_NOT_FOUND" };

  // Checks rival lobby
  const rivalLobby = await lobbyDB.getByTierChannelMessage(messageDiscordId);
  if (!rivalLobby) throw { name: "NO_RIVAL_LOBBY" };
  if (rivalLobby.status != "SEARCHING") throw { name: "RIVAL_NOT_SEARCHING" };
  if (rivalLobby.created_by === newPlayer.id) throw { name: "SAME_PLAYER" };

  // Check tier in case of yuzu
  const tier = await tierDB.getByTierMessage(messageDiscordId);
  if (tier.yuzu) {
    const yp = await yuzuPlayerDB.get(newPlayer.id, guild.id);
    const rivalYp = await yuzuPlayerDB.get(rivalLobby.created_by, guild.id);
    if (!yp || !rivalYp) throw { name: "NO_YUZU_PLAYER" };
    if (!((yp.parsec && rivalYp.yuzu) || (yp.yuzu && rivalYp.parsec)))
      throw { name: "YUZU_INCOMPATIBLE" };
  }

  // Checks player lobby
  let newPlayerLobby = await lobbyDB.getByPlayer(newPlayer.id, false);
  if (newPlayerLobby) {
    if (newPlayerLobby.status == "PLAYING") throw { name: "ALREADY_PLAYING" };
    if (["CONFIRMATION", "WAITING"].includes(newPlayerLobby.status))
      throw { name: "IN_CONFIRMATION" };
  } else {
    newPlayerLobby = await lobbyDB.create(guild.id, newPlayer.id, null, "FRIENDLIES", "WAITING");
  }

  const player = { player_id: newPlayer.id, lobby_id: newPlayerLobby.id };
  await matchmaking(rivalLobby.created_by, rivalLobby.id, guild.id, null, player);

  const rivalPlayer = await playerDB.get(rivalLobby.created_by, false);

  return {
    matched: true,
    players: [newPlayer.discord_id, rivalPlayer.discord_id],
  };
};

const stopSearch = async (playerDiscordId, messageId) => {
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);
  if (!lobby) throw { name: "LOBBY_NOT_FOUND" };

  // Tiers to Stop
  let tiersToStop = [];
  const searchingTiers = await lobbyTierDB.getByLobby(lobby.id);
  if (messageId) {
    const tier = await tierDB.getBySearchMessage(messageId);
    if (!tier) throw { name: "TIER_NOT_FOUND" };
    if (searchingTiers.some((x) => x.id === tier.id)) tiersToStop.push(tier);
    else
      throw {
        name: "NOT_SEARCHING_HERE",
        args: { tierId: tier.discord_id, yuzu: tier.yuzu },
      };
  } else {
    tiersToStop = searchingTiers.filter((tier) => tier.weight !== null);
  }

  if (tiersToStop.length === 0)
    throw {
      name: "NOT_SEARCHING_LAN",
    };

  if (lobby.status === "PLAYING") throw { name: "ALREADY_PLAYING" };
  if (lobby.status === "CONFIRMATION" || lobby.status === "WAITING")
    throw { name: "ALREADY_CONFIRMATION" };

  // Remove Tier
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    for (tier of tiersToStop) {
      const lobbyTier = await lobbyTierDB.get(lobby.id, tier.id, client);
      await lobbyTierDB.remove(lobby.id, tier.id, client);
      tier.lobbyTier = lobbyTier;
    }

    // If it was the last tier, remove the lobby
    hasTier = await lobbyTierDB.hasAnyTier(lobby.id, client);
    if (!hasTier && !lobby.ranked) await lobbyDB.remove(lobby.id, false, client);
    await client.query("COMMIT");

    return {
      isSearching: hasTier,
      tiers: tiersToStop,
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

const getMessages = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(player.id, "PLAYING", false);

  const messages = await lobbyMessageDB.getMessages(lobby.id);
  return messages;
};

const getTierMessages = async (playerDiscordId, status = "CONFIRMATION") => {
  const player = await playerDB.get(playerDiscordId, true);
  if (!player) throw { name: "PLAYER_NOT_FOUND" };

  const matchedLobby = await lobbyDB.getByPlayerStatus(player.id, status, false);

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

const getPlayingPlayers = async (playerDiscordId) => {
  const lobby = await lobbyDB.getByPlayerStatus(playerDiscordId, "PLAYING", true);
  if (!lobby) throw { name: "NOT_PLAYING" };

  const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id);
  return lobbyPlayers;
};

const saveSearchTierMessage = async (playerDiscordId, tierDiscordId, messageId, yuzu) => {
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);

  let tier;
  if (yuzu) {
    tier = await tierDB.getYuzu(lobby.guild_id);
  } else tier = await tierDB.get(tierDiscordId, true);
  await lobbyTierDB.updateMessage(lobby.id, tier.id, messageId);
  return true;
};

const saveRankedMessage = async (playerDiscordId, rankedRoleId, messageId) => {
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);
  const tier = await tierDB.getByRankedRole(rankedRoleId);
  const guild = await guildDB.get(tier.guild_id, false);

  await lobbyMessageDB.insert(lobby.id, messageId, guild.ranked_channel_id, true);
  return true;
};

const acceptMatch = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(player.id, "CONFIRMATION", false);

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
  const lobby = await lobbyDB.getByPlayerStatus(acceptedPlayer.id, "CONFIRMATION", false);

  const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id);
  const rejectedPlayers = lobbyPlayers.filter((player) => player.status != "ACCEPTED");

  const rejectedPlayer = await playerDB.get(rejectedPlayers[0].player_id, false);

  return await matchNotAccepted(rejectedPlayer, true);
};

const declineMatch = async (playerDiscordId) => {
  const declinePlayer = await playerDB.get(playerDiscordId, true);
  return await matchNotAccepted(declinePlayer, false);
};

const afterConfirmation = async (playerDiscordId, textChannelId, voiceChannelId) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const lobby = await lobbyDB.getByPlayerStatus(playerDiscordId, "CONFIRMATION", true, client);
    await lobbyDB.updateLobbyChannels(lobby.id, textChannelId, voiceChannelId, client);
    const allMessages = await lobbyTierDB.getAllMessages(lobby.id, client);
    await lobbyDB.removeOtherLobbies(lobby.id, client);
    await lobbyDB.updateStatus(lobby.id, "PLAYING", client);
    await lobbyPlayerDB.updateAllStatus(lobby.id, "PLAYING", client);
    await lobbyDB.removeOtherLobbies(lobby.id, client);

    const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id, client);
    await client.query("COMMIT");

    // Store tier messages
    for (message of allMessages) {
      await lobbyMessageDB.insert(lobby.id, message.message_id, message.channel_id, false, client);
    }

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

  const rivalPlayer = await matchmaking(player.id, lobby.id, lobby.guild_id);
  const guild = await guildDB.get(lobby.guild_id, false);

  return { rival: rivalPlayer, guild: guild.discord_id };
};

const closeArena = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(player.id, "PLAYING", false);

  if (!lobby) throw { name: "NOT_PLAYING" };
  const gameset = await gameSetDB.getByLobby(lobby.id);
  if (gameset) throw { name: "IN_GAMESET" };

  const client = await db.getClient();

  // Send guild discord Id
  const guild = await guildDB.get(lobby.guild_id, false);
  lobby.guild_id = guild.discord_id;

  try {
    await client.query("BEGIN");
    await lobbyDB.remove(lobby.id, false, client);
    await client.query("COMMIT");
    return lobby;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const timeOutCheck = async (lobbyId, acceptedPlayerId, afkPlayerId) => {
  const lobby = await lobbyDB.get(lobbyId, false);
  if (!lobby) return false;

  const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id);
  const isAccepted =
    lobbyPlayers.filter(
      (player) => player.discord_id == acceptedPlayerId && player.status == "ACCEPTED"
    ).length > 0;

  const isConfirmation =
    lobbyPlayers.filter(
      (player) => player.discord_id == afkPlayerId && player.status == "CONFIRMATION"
    ).length > 0;

  return isAccepted && isConfirmation;
};

const voteNewSet = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(textChannelId);
  const lobbyPlayer = await lobbyPlayerDB.get(lobby.id, player.id);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await lobbyPlayerDB.setNewSet(lobby.id, player.id, !lobbyPlayer.new_set, client);
    const decided = await lobbyPlayerDB.isNewSetDecided(lobby.id, client);

    if (decided) {
      const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id, client);
      await lobbyPlayerDB.setNewSet(lobby.id, player.id, false, client);
      await lobbyPlayerDB.setNewSet(lobby.id, opponent.id, false, client);
    }

    await client.query("COMMIT");
    return { decided, status: !lobbyPlayer.new_set };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const voteCancelSet = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(textChannelId);
  const lobbyPlayer = await lobbyPlayerDB.get(lobby.id, player.id);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await lobbyPlayerDB.setCancelSet(lobby.id, player.id, !lobbyPlayer.cancel_set, client);
    const decided = await lobbyPlayerDB.isCancelSetDecided(lobby.id, client);

    if (decided) {
      const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id, client);
      await lobbyPlayerDB.setCancelSet(lobby.id, player.id, false, client);
      await lobbyPlayerDB.setCancelSet(lobby.id, opponent.id, false, client);
    }

    await client.query("COMMIT");
    return { decided, status: !lobbyPlayer.cancel_set };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const getOpponent = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(textChannelId);

  const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id);
  return opponent;
};

const isInCurrentLobby = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(player.id, "PLAYING", false);

  return lobby && lobby.text_channel_id == textChannelId;
};

module.exports = {
  getByPlayer,
  getGuild,
  hasLobbyTiers,
  search,
  rankedSearch,
  stopSearch,
  saveSearchTierMessage,
  saveDirectMessage,
  getPlayingPlayers,
  getMessages,
  getTierMessages,
  getTierChannels,
  acceptMatch,
  declineMatch,
  timeoutMatch,
  afterConfirmation,
  matchmaking,
  directMatch,
  unAFK,
  closeArena,
  timeOutCheck,
  voteNewSet,
  voteCancelSet,
  getOpponent,
  isInCurrentLobby,
};
