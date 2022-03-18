const db = require("./index");

const get = async (playerId, discord = false, client = null) =>
  await db.basicGet("player", playerId, discord, client);

const getTier = async (playerId, guildId, client = null) => {
  const playerTierQuery = {
    text: `
      SELECT tier.* FROM tier
      INNER JOIN rating on tier.id = rating.tier_id 
      WHERE rating.player_id = $1
      AND rating.guild_id = $2`,
    values: [playerId, guildId],
  };

  const playerTierResult = await (client ?? db).query(playerTierQuery);
  return playerTierResult.rows.length > 0 ? playerTierResult.rows[0] : null;
};

module.exports = {
  get,
  getTier,
};
