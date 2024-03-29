const { NotFoundError } = require("../errors/notFound");
const db = require("../models/db");
const { getGuildOrThrow } = require("../models/guild");
const { getLobby } = require("../models/lobby");
const { MESSAGE_TYPES, insertMessage, Message, getMessage } = require("../models/message");
const { getPlayer, getPlayerOrThrow } = require("../models/player");
const { getTierByRole, getTier } = require("../models/tier");
const { getGuild } = require("./guild");

const saveConfirmationDM = async (playerDiscordId, messageId, isRanked = false) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  if (!messageId) throw new NotFoundError("Message");

  const lobby = await player.getLobby("CONFIRMATION");
  if (!lobby) throw new NotFoundError("Lobby");

  const lobbyPlayer = await lobby.getLobbyPlayer(player.id);
  if (!lobbyPlayer) throw new NotFoundError("LobbyPlayer");

  await lobbyPlayer.insertMessage(messageId, isRanked);
};

const saveConfirmationGuild = async (playerDiscordId, messageId, isRanked = false) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getLobbyOrThrow("CONFIRMATION");

  const lobbyPlayer = await lobby.getLobbyPlayer(player.id);
  if (!lobbyPlayer) throw new NotFoundError("LobbyPlayer");

  const guild = await lobby.getGuild();
  if (!guild) throw new NotFoundError("Guild");
  if (!guild.confirmationChannelId) throw NotFoundError("ConfirmationChannel");

  await lobbyPlayer.insertConfirmationGuildMessage(
    messageId,
    guild.confirmationChannelId,
    isRanked
  );
};

/**
 * Gets the messages that are in #tier-X, made by the players in the lobby
 *
 * @param {*} playerId DiscordId of the player
 * @param {*} status Status of the lobby where the player is right now
 * @returns A list of Messages, with two extra properties:
 *  - authorId : DiscordId of the player
 *  - roleId : DiscordId of the role of the tier
 */
const getSearchTierMessages = async (playerId, status = "CONFIRMATION") => {
  const player = await getPlayer(playerId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby(status);
  if (!lobby) throw new NotFoundError("Lobby");

  const messages = await lobby.getMessagesFromEveryone(MESSAGE_TYPES.LOBBY_TIER);

  for (let message of messages) {
    const author = await getPlayer(message.playerId, false);
    const role = await getTier(message.tierId);

    message.authorId = author.discordId;
    message.roleId = role.roleId;
  }

  return messages;
};

const popSearchTierMessages = async (playerId, status = "CONFIRMATION") => {
  const messages = await getSearchTierMessages(playerId, status);

  for (let message of messages) await message.remove();

  return messages;
};

const saveSearchTierMessage = async (playerDiscordId, tierDiscordId, messageId, yuzu) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getOwnLobby();
  if (!lobby) throw new NotFoundError("Lobby");

  const guild = await lobby.getGuild();
  if (!guild) throw new NotFoundError("Guild");

  let tier;
  if (yuzu) {
    tier = await guild.getYuzuTier();
  } else tier = await getTierByRole(tierDiscordId);

  if (!tier) throw new NotFoundError("Tier");

  const lt = await lobby.getLobbyTier(tier.id);
  if (!lt) throw new NotFoundError("LobbyTier");
  await lt.insertMessage(messageId);
  return true;
};

const saveSearchRankedMessage = async (playerDiscordId, messageId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getOwnLobby();
  if (!lobby) throw new NotFoundError("Lobby");

  const guild = await lobby.getGuild();
  if (!guild) throw new NotFoundError("Guild");

  await insertMessage(
    messageId,
    MESSAGE_TYPES.LOBBY_RANKED_SEARCH,
    null,
    guild.rankedChannelId,
    player.id,
    guild.id,
    lobby.id,
    true
  );
};

const getLeaderboardMessage = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const row = await db.getBy("message", {
    type: MESSAGE_TYPES.GUILD_LEADERBOARD,
    guild_id: guild.id,
  });

  if (row) return new Message(row);
  else return null;
};

/**
 * Get the ranked message of the player, and remove it from the DB
 * @param {string} playerDiscordId DiscordID of the player whose message is being popped
 * @returns
 */
const popRankedMessage = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getOwnLobby();
  if (!lobby) throw new NotFoundError("Lobby");

  const message = await lobby.getRankedMessage();
  if (message) {
    await message.remove();
  }
  return message;
};

const getMessagesFromLobby = async (lobbyId) => {
  const lobby = await getLobby(lobbyId);

  const messages = await lobby.getOwnMessages();
  for (let message of messages) {
    const author = await getPlayer(message.playerId, false);
    message.authorId = author.discordId;
  }

  return messages;
};

const getGuildFromMessage = async (messageDiscordId) => {
  const message = await getMessage(messageDiscordId, true);
  if (!message?.guildId) return null;

  return await getGuildOrThrow(message.guildId, false);
};

const deleteCharacterMessages = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby");

  const messages = await lobby.getCharacterMessages();
  for (let message of messages) {
    await message.remove();
  }
};

module.exports = {
  getSearchTierMessages,
  getLeaderboardMessage,
  getMessagesFromLobby,
  popSearchTierMessages,
  popRankedMessage,
  saveSearchTierMessage,
  saveConfirmationDM,
  saveConfirmationGuild,
  saveSearchRankedMessage,
  getGuildFromMessage,
  deleteCharacterMessages,
};
