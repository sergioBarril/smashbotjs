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

const matchmaking = async (playerId, lobbyId, targetTierId) => {
  const opponent = await lobbyDB.matchmaking(lobbyId, targetTierId);
  if (!opponent) return null;

  const { player_id: rivalPlayerId, lobby_id: rivalLobbyId } = opponent;

  const client = db.getClient();

  // Update status
  try {
    await client.query("BEGIN");
    await lobbyDB.updateStatus(lobbyId, "CONFIRMATION", client);
    await lobbyDB.updateStatus(rivalLobbyId, "WAITING", client);
    await lobbyPlayerDB.updateStatus(lobbyId, playerId, "CONFIRMATION", client);
    await lobbyPlayerDB.insert(
      rivalLobbyId,
      rivalPlayerId,
      "CONFIRMATION",
      client
    );
    await client.query("COMMIT");

    return rivalPlayerId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
};

// PUBLIC

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
      args: { target: targetTier.discord_id },
    };
  } else await lobbyDB.addTier(lobby.id, targetTier.id);

  const rivalPlayerId = await matchmaking(player.id, lobby.id, targetTier.id);

  // Unmatched, return info to send @Tier
  if (!rivalPlayerId) {
    return {
      matched: false,
      tierId: targetTier.discord_id,
      channelId: targetTier.channel_id,
    };
  }

  // Matched, return info to send confirmation DMs
  const rivalPlayer = await playerDB.get(rivalPlayerId, false);
  if (!rivalPlayer) throw { name: "ERROR", args: "rivalPlayer not found" };

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
    const lobbyTier = lobbyTierDB.get(lobby.id, tier.id, client);
    await lobbyTierDB.remove(lobby.id, tier.id, client);

    // If it was the last tier, remove the lobby
    hasTier = await lobbyTierDB.hasAnyTier(lobby.id, client);
    if (!hasTier) await lobbyDB.remove(lobby.id, false, client);
    await client.query("COMMIT");

    return {
      isSearching: hasTier,
      tierId: tier.id,
      channelId: tier.channel_id,
      messageId: lobbyTier.message_id,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
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

  const tierData = await lobbyTierDB.getMessages(player.id);
  if (!tierData) throw { name: "MESSAGES_NOT_FOUND" };

  return tierData.map((data) => {
    return {
      channelId: data.channel,
      messageId: data.messageId,
      tierId: data.discord_id,
    };
  });
};

const saveSearchTierMessage = async (playerDiscordId, tierId, messageId) => {
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);
  await lobbyTierDB.updateMessage(lobby.id, tierId, messageId);
  return true;
};

module.exports = {
  search,
  stopSearch,
  saveSearchTierMessage,
  saveDirectMessage,
  getTierMessages,
};
