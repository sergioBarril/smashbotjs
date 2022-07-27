const { NotFoundError } = require("../errors/notFound");
const { insertMessage } = require("../models/message");
const { getPlayer } = require("../models/player");
const { getTier } = require("../models/tier");

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
  } else tier = await getTier(tierDiscordId, true);

  if (!tier) throw new NotFoundError("Tier");

  const message = await insertMessage({
    discordId: messageId,
    guildId: guild.id,
    channelId: tier.channelId,
    lobbyId: lobby.id,
    playerId: player.id,
    ranked: false,
    tierId: tier.id,
  });

  const lt = await lobby.getLobbyTier(tier.id);
  if (!lt) throw new NotFoundError("LobbyTier");
  await lt.setMessage(message.id);
  return true;
};

module.exports = { saveSearchTierMessage };
