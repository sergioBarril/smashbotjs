const { NotFoundError } = require("../errors/notFound");
const { getPlayer } = require("../models/player");
const { getTier } = require("../models/tier");
const { getGuild } = require("./guild");

const getRankedRole = async (playerDiscordId, guildDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const guild = await guildDB.get(guildDiscordId, true);

  const rating = await ratingDB.getByPlayerGuild(player.id, guild.id);

  const tierId = rating.tier_id;
  if (!tierId) throw { name: "NO_TIER" };

  const tier = await tierDB.get(tierId, false);

  return tier.ranked_role_id;
};

/**
 * Get the tier of the player in the given guild
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} guildDiscordId DiscordID of the guild
 * @returns Tier of the player
 */
const getPlayerTier = async (playerDiscordId, guildDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const rating = await player.getRating(guild.id);
  if (!rating) throw new NotFoundError("Rating");

  return await getTier(rating.tierId);
};

module.exports = {
  getPlayerTier,
};
