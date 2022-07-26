const db = require("./db");

class Rating {
  constructor({ id, player_id, guild_id, score, tier_id }) {
    this.id = id;
    this.player_id = player_id;
    this.guildId = guild_id;
    this.score = score;
  }

  setTier = async (tierId, client = null) => {
    await db.updateBy("rating", { tier_id: tierId }, { id: ratingId }, client);
  };
}

const getRating = async (ratingId, client = null) => {
  const rating = await db.basicGet("rating", ratingId, false, client);
  if (rating == null) return null;
  return Rating(rating);
};

const create = async (playerId, guildId, tierId, score, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO rating(player_id, guild_id, tier_id, score)
    VALUES ($1, $2, $3, $4)
    `,
    values: [playerId, guildId, tierId, score],
  };

  await db.insertQuery(insertQuery, client);
};

module.exports = {
  getRating,
  create,
  Rating,
};
