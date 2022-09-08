const { NotFoundError } = require("../errors/notFound");
const { getPlayer } = require("../models/player");
const { getTier } = require("../models/tier");
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
  opponentOldScore = null
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

  oldRating.tier = tier;
  rating.tier = tier;

  const streak = await rating.getStreak();

  if (streak > 0) {
    if (!rating.promotion && nextTier) {
      let scoreToAdd = 20 + 5 * streak;
      if (!isSameTier) scoreToAdd = 15;
      let newScore = rating.score + scoreToAdd;
      if (newScore > nextTier.threshold) {
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
      const newScore = Number.parseInt(rating.score + scoreToAdd);

      await rating.setScore(newScore);
    }
  } else {
    if (!rating.promotion) {
      let scoreToSubstract = 20 + 5 * -streak;
      if (!isSameTier) scoreToSubstract = 15;
      if (!nextTier) {
        //ELO
        const probability = getProbability(rating.score, opponentOldScore || opponentRating.score);
        scoreToSubstract = 42 * probability;
        scoreToSubstract = scoreToSubstract * (1 - 0.05 * streak); // streak is negative: ;
      }

      let newScore = Number.parseInt(rating.score - scoreToSubstract);
      if (newScore < tier.threshold - 150 && previousTier) {
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
 * Get all the ratings of all players, split by tier and ordered by score
 * @param {string} guildDiscordId Guild discord ID
 * @returns
 */
const getRatingsByTier = async (guildDiscordId) => {
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

module.exports = {
  getRating,
  getPlayerTier,
  updateScore,
  getRatingsByTier,
};
