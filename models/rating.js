const { Client } = require("pg");
const db = require("./db");
const { Gameset } = require("./gameset");
const { getTier } = require("./tier");

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
    promotion_bonus_score,
    promotion_bonus_sets,
  }) {
    this.id = id;
    this.playerId = player_id;
    this.guildId = guild_id;
    this.tierId = tier_id;

    this.score = score;
    this.promotion = promotion;
    this.promotionWins = promotion_wins;
    this.promotionLosses = promotion_losses;
    this.promotionBonusScore = promotion_bonus_score;
    this.promotionBonusSets = promotion_bonus_sets;
  }

  /**
   * Return last gamesets
   * @param {int} limit Number of sets to return
   * @param {int} offset Ignore the last X gamesets
   * @param {Boolean} isRanked Only consider ranked sets
   * @param {Client} client Optional pg Client
   * @returns
   */
  getLastSets = async (limit = "ALL", offset = 0, isRanked = true, client = null) => {
    const rankedCondition = isRanked ? " AND ranked " : "";

    const getQuery = {
      text: `
        SELECT DISTINCT gs.* FROM gameset gs
        INNER JOIN game g
          ON g.gameset_id = gs.id
        INNER JOIN game_player gp
          ON gp.game_id = g.id
        WHERE gp.player_id = $1
        AND guild_id = $2
        AND gs.winner_id IS NOT NULL
        ${rankedCondition}
        ORDER BY finished_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      values: [this.playerId, this.guildId],
    };

    const result = await db.getQuery(getQuery, client, true);
    const gamesets = result.map((row) => new Gameset(row));

    return gamesets;
  };

  getSetCount = async (isRanked = true, client = null) => {
    const rankedCondition = isRanked ? " AND ranked " : "";
    const getQuery = {
      text: `
        SELECT COUNT(1) as sets, COUNT(vic.id) as wins FROM (
          SELECT DISTINCT gs.id AS id FROM gameset gs
        INNER JOIN game g
          ON g.gameset_id = gs.id
        INNER JOIN game_player gp
          ON gp.game_id = g.id
        WHERE gp.player_id = $1
        AND guild_id = $2
        AND gs.winner_id IS NOT NULL
        ${rankedCondition}
        ) gsets
        LEFT JOIN
        (
          SELECT DISTINCT gs.id AS id FROM gameset gs
        INNER JOIN game g
          ON g.gameset_id = gs.id
        INNER JOIN game_player gp
          ON gp.game_id = g.id
        WHERE gp.player_id = $1
        AND gs.winner_id = $1
        AND guild_id = $2
        AND gs.winner_id IS NOT NULL
        ${rankedCondition}
        ) vic
        ON gsets.id = vic.id`,
      values: [this.playerId, this.guildId],
    };

    const result = await db.getQuery(getQuery, client);
    return { sets: Number(result.sets), wins: Number(result.wins) };
  };

  /**
   *
   * @param {Client} client Optional pg client
   */
  getStreak = async (isRanked = true, client = null) => {
    const rankedCondition = isRanked ? " AND ranked " : "";
    const getQuery = {
      text: `      
        SELECT DISTINCT gs.* FROM gameset gs
        INNER JOIN game g
          ON g.gameset_id = gs.id
        INNER JOIN game_player gp
          ON gp.game_id = g.id
        WHERE gp.player_id = $1
        AND guild_id = $2
        ${rankedCondition}        
        ORDER BY finished_at DESC
        LIMIT 5
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
   *
   */
  checkPromoTiers = async (opponentRating, client = null) => {
    if (!this.isPromotion) return false;

    const tier = await getTier(this.tierId, client);
    const opponentTier = await getTier(opponentRating.tierId, client);

    if (!tier || !opponentTier) return false;

    return opponentTier.weight === tier.weight - 1;
  };

  /**
   * Returns true if during this player's promo, they have already won against the Opponent
   * @param {int} opponentId Player.id of the opponent
   * @param {Client} client Optional PG Client
   * @returns
   */
  wonAgainstInPromo = async (opponentId, client = null) => {
    if (!this.isPromotion) return false;

    const gameCount = this.promotionWins + this.promotionLosses + this.promotionBonusSets;

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

  setPromotionBonusScore = async (promotionBonusScore, client = null) => {
    await db.updateBy(
      "rating",
      { promotion_bonus_score: promotionBonusScore },
      { id: this.id },
      client
    );
    this.promotionBonusScore = promotionBonusScore;
  };

  addPromotionBonusScore = async (promotionBonusScoreToAdd, client = null) => {
    let totalBonusScore = this.promotionBonusScore + promotionBonusScoreToAdd;

    // UPPER LIMIT IN BONUS SCORE
    if (totalBonusScore > 75) totalBonusScore = 75;

    await db.updateBy(
      "rating",
      { promotion_bonus_score: totalBonusScore },
      { id: this.id },
      client
    );

    this.promotionBonusScore = totalBonusScore;
  };

  setPromotionBonusSets = async (promotionBonusSets, client = null) => {
    await db.updateBy(
      "rating",
      { promotion_bonus_sets: promotionBonusSets },
      { id: this.id },
      client
    );
    this.promotionBonusSets = promotionBonusSets;
  };

  startPromotion = async (client = null) => {
    await this.setPromotion(true, client);
    await this.setPromotionWins(0, client);
    await this.setPromotionLosses(0, client);
    await this.setPromotionBonusScore(0, client);
    await this.setPromotionBonusSets(0, client);
  };

  endPromotion = async (client = null) => {
    await this.setPromotion(false, client);
    await this.setPromotionWins(null, client);
    await this.setPromotionLosses(null, client);
    await this.setPromotionBonusScore(null, client);
    await this.setPromotionBonusSets(null, client);
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
