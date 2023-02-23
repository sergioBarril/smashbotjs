const { Client } = require("pg");
const db = require("./db");
const { Gameset } = require("./gameset");

class Rating {
  constructor({
    id,
    player_id,
    guild_id,
    score,
    tier_id,
    promotion,
    promotion_wins,
    promotion_losses,
  }) {
    this.id = id;
    this.playerId = player_id;
    this.guildId = guild_id;
    this.tierId = tier_id;

    this.score = score;
    this.promotion = promotion;
    this.promotionWins = promotion_wins;
    this.promotionLosses = promotion_losses;
  }

  /**
   *
   * @param {Client} client Optional pg client
   */
  getStreak = async (client = null) => {
    const getQuery = {
      text: `
      SELECT *
      FROM gameset 
      WHERE id IN (
        SELECT DISTINCT gs.id FROM gameset gs
        INNER JOIN game g
          ON g.gameset_id = gs.id
        INNER JOIN game_player gp
          ON gp.game_id = g.id
        WHERE gp.player_id = $1
      )
      AND guild_id = $2
      ORDER BY finished_at DESC
      LIMIT 3
      `,
      values: [this.playerId, this.guildId],
    };

    const result = await db.getQuery(getQuery, client, true);
    const gamesets = result.map((row) => new Gameset(row));

    let streak = 0;
    for (let gs of gamesets) {
      if (gs.winnerId === this.playerId && streak >= 0) streak++;
      else if (gs.winnerId !== this.playerId && streak <= 0) streak--;
      else break;
    }

    return streak;
  };

  /**
   * Returns true if during this player's promo, they have already won against the Opponent
   * @param {int} opponentId Player.id of the opponent
   * @param {Client} client Optional PG Client
   * @returns
   */
  wonAgainstInPromo = async (opponentId, client = null) => {
    if (!this.isPromotion) return false;

    const gameCount = this.promotionWins + this.promotionLosses;

    const getQuery = {
      text: `
        SELECT 1 FROM (
          SELECT gset.id as id, gset.winner_id as winner_id FROM gameset gset
          INNER JOIN game gm
            ON gm.gameset_id = gset.id
          INNER JOIN game_player gplayer
            ON gplayer.game_id = gm.id
          WHERE gset.ranked
          AND gplayer.player_id = $2
          GROUP BY gset.id, gset.winner_id
          ORDER BY gset.created_at DESC
          LIMIT $1
        ) gs 
        INNER JOIN game g
          ON g.gameset_id = gs.id
        INNER JOIN game_player gp1
          ON g.id = gp1.game_id
        INNER JOIN game_player gp2
          ON g.id = gp2.game_id
        WHERE gp1.player_id = $2
        AND gp2.player_id = $3
        AND gs.winner_id = $2
      `,
      values: [gameCount, this.playerId, opponentId],
    };

    const result = await db.getQuery(getQuery, client);
    return Boolean(result);
  };

  setTier = async (tierId, client = null) => {
    await db.updateBy("rating", { tier_id: tierId }, { id: this.id }, client);
    this.tierId = tierId;
  };

  setPromotion = async (isPromotion, client = null) => {
    await db.updateBy("rating", { promotion: isPromotion }, { id: this.id }, client);
    this.promotion = isPromotion;
  };

  setPromotionWins = async (promotionWins, client = null) => {
    await db.updateBy("rating", { promotion_wins: promotionWins }, { id: this.id }, client);
    this.promotionWins = promotionWins;
  };

  setPromotionLosses = async (promotionLosses, client = null) => {
    await db.updateBy("rating", { promotion_losses: promotionLosses }, { id: this.id }, client);
    this.promotionLosses = promotionLosses;
  };

  startPromotion = async (client = null) => {
    await this.setPromotion(true, client);
    await this.setPromotionWins(0, client);
    await this.setPromotionLosses(0, client);
  };

  endPromotion = async (client = null) => {
    await this.setPromotion(false, client);
    await this.setPromotionWins(null, client);
    await this.setPromotionLosses(null, client);
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
