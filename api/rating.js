const playerDB = require("../db/player");
const guildDB = require("../db/guild");

const ratingDB = require("../db/rating");
const tierDB = require("../db/tier");

const getRankedRole = async (playerDiscordId, guildDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const guild = await guildDB.get(guildDiscordId, true);

  const rating = await ratingDB.getByPlayerGuild(player.id, guild.id);

  const tierId = rating.tier_id;
  if (!tierId) throw { name: "NO_TIER" };

  const tier = await tierDB.get(tierId, false);

  return tier.ranked_role_id;
};

module.exports = {
  getRankedRole,
};
