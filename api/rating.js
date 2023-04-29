const { NotFoundError } = require("../errors/notFound");
const { getGuildOrThrow } = require("../models/guild");
const { getPlayer, getPlayerOrThrow } = require("../models/player");
const { getTier, getTierByRole } = require("../models/tier");
const { getGuild } = require("./guild");

/**
 * Get the tier of the player in the given guild
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {boolean} ignorePromotion If true, return the tier. If false and is in promotion,
 * return next tier
 * @returns Tier of the player
 */
const getPlayerTier = async (playerDiscordId, guildDiscordId, ignorePromotion = false) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const rating = await player.getRating(guild.id);
  if (!rating) return null;

  let tier = await getTier(rating.tierId);

  if (!ignorePromotion && rating.promotion) tier = await tier.getNextTier();

  return tier;
};

/**
 *
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} roleId DiscordID of the tier role
 * @param {boolean} changeScore True if it should set score
 */
const setPlayerTier = async (playerDiscordId, guildDiscordId, roleId, changeScore = true) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const rating = await player.getRating(guild.id);
  if (!rating) throw new NotFoundError("Rating");

  if (roleId) {
    const tier = await getTierByRole(roleId);
    if (!tier) throw new NotFoundError("Tier");
    await rating.setTier(tier.id);
    if (changeScore) await rating.setScore(tier.threshold);
  } else {
    await rating.setTier(null);
    if (changeScore) await rating.setScore(null);
  }

  await rating.setPromotion(false);
  await rating.setPromotionWins(null);
  await rating.setPromotionLosses(null);

  return rating;
};

const getRating = async (playerDiscordId, guildDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const rating = await player.getRating(guild.id);

  return rating;
};

const rankUp = async (rating, nextTier) => {
  await rating.setTier(nextTier.id);
  if (rating.promotionBonusScore > 0)
    await rating.setScore(rating.score + rating.promotionBonusScore);
  await rating.endPromotion();
};

const rankDown = async (rating, previousTier) => {
  await rating.setTier(previousTier.id);
  await rating.setScore(rating.score + 50);
};

/**
 * Returns the probability that p1 wins
 * @param {int} p1Score Score of player1
 * @param {int} p2Score Score of player2
 * @returns {Number} The probability that player1 wins against player2
 */
const getProbability = (p1Score, p2Score) => {
  const qa = 10 ** (p1Score / 400);
  const qb = 10 ** (p2Score / 400);
  return qa / (qa + qb);
};

const updateBonusScore = async (promoRating, weightDiff, isWin) => {
  let addScore = null;
  if (weightDiff == 0) addScore = isWin ? 10 : -10;
  else if (weightDiff < 0) addScore = isWin ? 5 : -10;
  else if (weightDiff > 0) addScore = isWin ? 15 : -10;

  await promoRating.addPromotionBonusScore(addScore);
  await promoRating.setPromotionBonusSets(promoRating.promotionBonusSets + 1);

  if (!isWin && promoRating.promotionBonusScore <= -50) return true;
  else return false;
};

/**
 *  Updates the score rating of the player after a set against opponent.
 * @param {string} playerDiscordId DiscordID of the player whose score we're updating
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} opponentDiscordId DiscordID of the player with whom the set was played
 * @param {int} opponentOldScore Opponent's score before this set happened
 * @returns
 */
const updateScore = async (
  playerDiscordId,
  guildDiscordId,
  opponentDiscordId,
  opponentOldScore = null,
  playerRoles = []
) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const rating = await player.getRating(guild.id);
  if (!rating) throw new NotFoundError("Rating");

  const oldRating = { ...rating };

  const opponent = await getPlayer(opponentDiscordId, true);
  const opponentRating = await opponent.getRating(guild.id);
  const isSameTier =
    opponentRating.tierId === rating.tierId || opponentRating.promotion || rating.promotion;

  const tier = await getTier(rating.tierId);
  const nextTier = await tier.getNextTier();
  const previousTier = await tier.getPreviousTier();

  const opponentTier = await getTier(opponentRating.tierId);
  const upset = opponentTier.weight < tier.weight;

  let isBonus = false;

  if (rating.promotion) {
    const bonus = await isBonusMatch(playerDiscordId, opponentDiscordId, guildDiscordId);
    isBonus = bonus.isBonus;
  }

  oldRating.tier = tier;
  rating.tier = tier;

  // Win/Lose streak. Positive if win, negative if lose
  let streak = await rating.getStreak();

  const hasStreakBoost = false; //playerRoles.hasAny(guild.tryhardSupporterRoleId, guild.proSupporterRoleId);
  const demotionProtection = 0; //playerRoles.has(guild.proSupporterRoleId) ? 100 : 0;

  if (hasStreakBoost && streak < 0) streak = -1;
  if (!hasStreakBoost && streak < -3) streak = -3;
  if (!hasStreakBoost && streak > 3) streak = 3;

  const rankedCountToday = await player.getRankedCountToday(opponent.id);

  if (streak > 0) {
    if (!rating.promotion && nextTier) {
      let scoreToAdd = 20 + 5 * streak;
      if (!isSameTier) scoreToAdd = 15;
      if (!isSameTier && upset) scoreToAdd = 25;
      if (rankedCountToday == 3) scoreToAdd = 10;
      if (rankedCountToday > 3) scoreToAdd = 5;

      let newScore = rating.score + scoreToAdd;
      if (newScore >= nextTier.threshold) {
        await rating.setScore(nextTier.threshold);
        await rating.startPromotion();
      } else await rating.setScore(newScore);
    } else if (rating.promotion) {
      if (isBonus) {
        await updateBonusScore(rating, tier.weight - opponentTier.weight, true);
      } else {
        await rating.setPromotionWins(rating.promotionWins + 1);
        if (rating.promotionWins >= 3) {
          await rankUp(rating, nextTier);
          rating.tier = nextTier;
        }
      }
    } else if (rating.score < tier.threshold + 200) {
      scoreToAdd = 15;
      if (rankedCountToday == 3) scoreToAdd = 10;
      if (rankedCountToday > 3) scoreToAdd = 5;
      await rating.setScore(rating.score + scoreToAdd);
    } else {
      // ELO FOR TIER X
      const probability = getProbability(rating.score, opponentOldScore || opponentRating.score);
      let scoreToAdd = 42 * (1 - probability);
      scoreToAdd = scoreToAdd * (1 + 0.05 * streak);

      if (scoreToAdd < 10) {
        scoreToAdd = 10;
      }

      if (rankedCountToday == 3 && scoreToAdd > 10) scoreToAdd = 10;
      if (rankedCountToday > 3 && scoreToAdd > 5) scoreToAdd = 5;

      const newScore = Number.parseInt(rating.score + scoreToAdd);

      await rating.setScore(newScore);
    }
  } else {
    if (!rating.promotion) {
      let scoreToSubstract = 20 + 5 * -streak;
      if (!isSameTier) scoreToSubstract = 15;
      else if (!nextTier && rating.score < tier.threshold + 200) {
        scoreToSubstract = 10;
      } else if (!nextTier && rating.score >= tier.threshold + 200) {
        //ELO
        const probability = getProbability(rating.score, opponentOldScore || opponentRating.score);
        scoreToSubstract = 42 * probability;
        scoreToSubstract = scoreToSubstract * (1 - 0.05 * streak); // streak is negative: ;

        if (scoreToSubstract > 10) scoreToSubstract = 10;
      }

      if (rankedCountToday == 3 && scoreToSubstract > 10) scoreToSubstract = 10;
      if (rankedCountToday > 3 && scoreToSubstract > 5) scoreToSubstract = 5;

      let newScore = Number.parseInt(rating.score - scoreToSubstract);
      if (newScore < tier.threshold - (200 + demotionProtection) && previousTier) {
        await rating.setScore(newScore);
        await rankDown(rating, previousTier);
        rating.tier = previousTier;
      } else if (!previousTier && newScore < tier.threshold - 200)
        await rating.setScore(tier.threshold - 200);
      else await rating.setScore(newScore);
    } else {
      let isPromoStopped = false;
      if (isBonus)
        isPromoStopped = await updateBonusScore(rating, tier.weight - opponentTier.weight, false);
      else {
        await rating.setPromotionLosses(rating.promotionLosses + 1);
        isPromoStopped = rating.promotionLosses >= 3;
      }

      if (isPromoStopped) {
        let newScoreDiff = -50 + 20 * rating.promotionWins;

        if (rating.promotionBonusScore > 0) newScoreDiff += rating.promotionBonusScore;
        if (newScoreDiff >= 0) newScoreDiff = -5;

        await rating.setScore(rating.score + newScoreDiff);
        await rating.endPromotion();
      }
    }
  }

  return { oldRating, rating };
};

const isBonusMatch = async (player1DiscordId, player2DiscordId, guildDiscordId) => {
  const player1 = await getPlayerOrThrow(player1DiscordId, true);
  const player2 = await getPlayerOrThrow(player2DiscordId, true);
  const guild = await getGuildOrThrow(guildDiscordId, true);

  const rating1 = await player1.getRating(guild.id);
  const rating2 = await player2.getRating(guild.id);

  const result = {
    isBonus: false,
    reason: null,
    promoPlayer: null,
    normalPlayer: null,
  };

  if (!rating1 || !rating2) return result;
  if (!rating1.promotion && !rating2.promotion) return result;
  if (rating1.promotion && rating2.promotion) {
    result.isBonus = true;
    result.reason = "BOTH_PROMO";
    return result;
  }

  const checkTruePromo = async (r1, r2, p1, p2) => {
    if (!r1.promotion) return false;

    result.promoPlayer = p1.discordId;
    result.normalPlayer = p2.discordId;

    const tierRule = await r1.checkPromoTiers(r2);

    if (!tierRule) {
      result.isBonus = true;
      result.reason = "TIER_DIFF";
      return false;
    }

    const alreadyBeat = await r1.wonAgainstInPromo(p2.id);

    if (alreadyBeat) {
      result.isBonus = true;
      result.reason = "ALREADY_BEAT";
      return false;
    }

    return true;
  };

  if (rating1.promotion) await checkTruePromo(rating1, rating2, player1, player2);
  else await checkTruePromo(rating2, rating1, player2, player1);

  return result;
};

/**
 * Get all the ratings of all players, split by tier and ordered by score
 * @param {string} guildDiscordId Guild discord ID
 * @returns
 */
const getRatingsSortedByTier = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const leaderboardInfo = await guild.getLeaderboardInfo();
  const tierIds = [...new Set(leaderboardInfo.map((row) => row.rating.tierId))];

  const obj = {};
  tierIds.forEach((tierId) => {
    obj[tierId] = [];

    leaderboardInfo
      .filter((row) => row.rating.tierId === tierId)
      .sort((a, b) => {
        const scoreDiff = b.rating.score - a.rating.score;
        if (scoreDiff != 0) return scoreDiff;
        if (!a.rating.promotion) return 0;

        const winDiff = b.rating.promotionWins - a.rating.promotionWins;
        if (winDiff != 0) return winDiff;

        return b.rating.promotionLosses - a.rating.promotionLosses;
      })
      .forEach((row) => obj[tierId].push(row));
  });

  return obj;
};

const getRatingsByTier = async (tierRoleId) => {
  const tier = await getTierByRole(tierRoleId);

  if (!tier) throw new NotFoundError("Tier");

  const guild = await tier.getGuild();

  const leaderboardInfo = await guild.getLeaderboardInfo(tier.id);

  return leaderboardInfo.sort((a, b) => {
    const scoreDiff = b.rating.score - a.rating.score;
    if (scoreDiff != 0) return scoreDiff;
    if (!a.rating.promotion) return 0;

    const winDiff = b.rating.promotionWins - a.rating.promotionWins;
    if (winDiff != 0) return winDiff;

    return b.rating.promotionLosses - a.rating.promotionLosses;
  });
};

/**
 * Set the score of the player
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {int} newScore New score
 * @returns
 */
async function setScore(playerDiscordId, guildDiscordId, newScore) {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const rating = await player.getRating(guild.id);
  if (!rating) throw new NotFoundError("Rating");

  const oldScore = rating.score;
  await rating.setScore(newScore);
  return { oldScore, newScore };
}

/**
 * Set the promotion status, wins and losses
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {boolean} isPromotion True if is in promotion
 * @param {int} promotionWins Number of wins in promo
 * @param {int} promotionLosses Number of losses in promo
 * @returns
 */
async function setPromotion(
  playerDiscordId,
  guildDiscordId,
  isPromotion,
  promotionWins = null,
  promotionLosses = null
) {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  const rating = await player.getRating(guild.id);
  if (!rating) throw new NotFoundError("Rating");

  if (isPromotion) {
    promotionWins = promotionWins ?? 0;
    promotionLosses = promotionLosses ?? 0;
  }
  if (!isPromotion) {
    promotionWins = null;
    promotionLosses = null;
  }

  await rating.setPromotion(isPromotion);
  await rating.setPromotionWins(promotionWins);
  await rating.setPromotionLosses(promotionLosses);
  return rating;
}

module.exports = {
  getRating,
  getPlayerTier,
  setPlayerTier,
  updateScore,
  getRatingsSortedByTier,
  getRatingsByTier,
  setScore,
  setPromotion,
  isBonusMatch,
};
