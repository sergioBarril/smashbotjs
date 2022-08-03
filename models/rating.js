const db = require("./db");

class Rating {
  constructor({ id, player_id, guild_id, score, tier_id }) {
    this.id = id;
    this.playerId = player_id;
    this.guildId = guild_id;
    this.tierId = tier_id;

    this.score = score;
  }

  setTier = async (tierId, client = null) => {
    await db.updateBy("rating", { tier_id: tierId }, { id: this.id }, client);
    this.tierId = tierId;
  };

  setScore = async (newScore, client = null) => {
    await db.updateBy("rating", { score: newScore }, { id: this.id }, client);
    this.score = newScore;
  };

  remove = async (client = null) => await db.basicRemove("rating", this.id, false, client);
}

const getRating = async (ratingId, client = null) => {
  const rating = await db.basicGet("rating", ratingId, false, client);
  if (rating == null) return null;
  return new Rating(rating);
};

module.exports = {
  Rating,
  getRating,
};
