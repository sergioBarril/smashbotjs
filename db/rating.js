const db = require("./index");

const get = async (ratingId, client = null) => await db.basicGet("rating", ratingId, false, client);

const getByPlayerGuild = async (playerId, guildId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM rating
   WHERE player_id = $1 
   AND guild_id = $2`,
    values: [playerId, guildId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const create = async (playerId, guildId, tierId, score, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO rating(player_id, guild_id, tier_id, score)
    VALUES ($1, $2, $3, $4)
    `,
    values: [playerId, guildId, tierId, score],
  };

  await (client ?? db).query(insertQuery);
};

const setTier = async (ratingId, tierId, client = null) => {
  const updateQuery = {
    text: `
    UPDATE rating
    SET tier_id = $1
    WHERE id = $2    
    `,
    values: [tierId, ratingId],
  };

  await (client ?? db).query(updateQuery);
};

module.exports = {
  get,
  getByPlayerGuild,
  create,
  setTier,
};
