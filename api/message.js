const { NotFoundError } = require("../errors/notFound");
const { getPlayer } = require("../models/player");
const { getTierByRole } = require("../models/tier");

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

module.exports = { saveSearchTierMessage, saveConfirmationDM };
