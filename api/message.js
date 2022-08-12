const { NotFoundError } = require("../errors/notFound");
const { MESSAGE_TYPES } = require("../models/message");
const { getPlayer } = require("../models/player");
const { getTierByRole, getTier } = require("../models/tier");

const saveConfirmationDM = async (playerDiscordId, messageId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  if (!messageId) throw new NotFoundError("Message");

  const lobby = await player.getLobby("CONFIRMATION");
  if (!lobby) throw new NotFoundError("Lobby");

  const lobbyPlayer = await lobby.getLobbyPlayer(player.id);
  if (!lobbyPlayer) throw new NotFoundError("LobbyPlayer");

  await lobbyPlayer.insertMessage(messageId);
};

/**
 * Gets the messages that are in #tier-X, made by the player
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

module.exports = { getSearchTierMessages, saveSearchTierMessage, saveConfirmationDM };
