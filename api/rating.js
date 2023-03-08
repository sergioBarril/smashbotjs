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
      await rating.setPromotionWins(rating.promotionWins + 1);
      if (rating.promotionWins >= 3) {
        await rankUp(rating, nextTier);
        rating.tier = nextTier;
      }
    } else {
      // ELO
      const probability = getProbability(rating.score, opponentOldScore || opponentRating.score);
      let scoreToAdd = 42 * (1 - probability);
      scoreToAdd = scoreToAdd * (1 + 0.05 * streak);

      if (scoreToAdd < 5) {
        scoreToAdd = 5;
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
      else if (!nextTier) {
        //ELO
        const probability = getProbability(rating.score, opponentOldScore || opponentRating.score);
        scoreToSubstract = 42 * probability;
        scoreToSubstract = scoreToSubstract * (1 - 0.05 * streak); // streak is negative: ;
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
      await rating.setPromotionLosses(rating.promotionLosses + 1);
      if (rating.promotionLosses >= 3) {
        await rating.setScore(rating.score - 50 + 20 * rating.promotionWins);
        await rating.endPromotion();
      }
    }
  }

  return { oldRating, rating };
};

/**
 * Returns true if promoPlayer is promo AND has already beat opponent during the promo
 * @param {*} promoPlayerDiscordId
 * @param {*} opponentDiscordId
 * @param {*} guildDiscordId
 * @returns
 */
const wonAgainstInPromo = async (promoPlayerDiscordId, opponentDiscordId, guildDiscordId) => {
  const promoPlayer = await getPlayerOrThrow(promoPlayerDiscordId, true);
  const opponent = await getPlayerOrThrow(opponentDiscordId, true);
  const guild = await getGuildOrThrow(guildDiscordId, true);

  const promoRating = await promoPlayer.getRating(guild.id);
  if (!promoRating || !promoRating.isPromotion) return false;
  else return promoRating.wonAgainstInPromo(opponent.id);
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
      .sort((a, b) => b.rating.score - a.rating.score)
      .forEach((row) => obj[tierId].push(row));
  });

  return obj;
};

const getRatingsByTier = async (tierRoleId) => {
  const tier = await getTierByRole(tierRoleId);

  if (!tier) throw new NotFoundError("Tier");

  const guild = await tier.getGuild();

  const leaderboardInfo = await guild.getLeaderboardInfo(tier.id);

  return leaderboardInfo.sort((a, b) => b.rating.score - a.rating.score);
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
  wonAgainstInPromo,
};
