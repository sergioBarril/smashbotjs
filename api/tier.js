const { NotFoundError } = require("../errors/notFound");
const { getGuild, getGuildOrThrow } = require("../models/guild");
const { getTierByRole, insertTier } = require("../models/tier");

/**
 * Añade la tier
 * @param {string} roleDiscordId DiscordID of the role of the tier
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} channelDiscordId DiscordID of the channel of the tier
 * @param {int} weight Weight of the tier (1 for tier 1, 3 for tier 3, etc.)
 * @param {int} threshold Base score of a tier
 */
const addTier = async (roleDiscordId, guildDiscordId, channelDiscordId, weight, threshold) => {
  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  await insertTier(roleDiscordId, channelDiscordId, guild.id, weight, threshold, false);
};

/**
 * Sets the ranked tier of a tier
 * @param {string} roleDiscordId DiscordID of the role of the existing tier
 * @param {string} rankedRoleId DiscordID of the role of the ranked
 */
const addRankedTier = async (roleDiscordId, rankedRoleId) => {
  const tier = await getTierByRole(roleDiscordId);
  if (!tier) throw new NotFoundError("Tier");
  await tier.setRankedRole(rankedRoleId);

  return tier;
};

/**
 * Add the yuzu tier
 * @param {string} yuzuDiscordId DiscordID of the role of yuzu
 * @param {string} parsecDiscordId DiscordID of the role of parsec
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} channelDiscordId DiscordID of the channel
 */
const addYuzuTier = async (yuzuDiscordId, parsecDiscordId, guildDiscordId, channelDiscordId) => {
  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  // General yuzu tier
  const tier = await insertTier(null, channelDiscordId, guild.id, null, null, true);

  // Guild yuzu role
  await guild.setYuzuRole(yuzuDiscordId);
  await guild.setParsecRole(parsecDiscordId);
};

/**
 * Gets all the tiers of the guild
 * @param {string} guildDiscordId Discord ID of the guild
 * @returns All the tiers of the guild. Weighted property for the LAN Cable, open for the rest
 */
const getTiers = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  const tiers = await guild.getTiers();

  const weighted = tiers.filter((tier) => tier.weight !== null);
  const open = tiers.filter((tier) => tier.weight === null);

  return { weighted, open };
};

const getTier = async (guildDiscordId, tierRoleId) => {
  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  return await getTierByRole(tierRoleId);
};

const getNextTier = async (guildDiscordId, tierRoleId) => {
  await getGuildOrThrow(guildDiscordId, true);
  const baseTier = await getTierByRole(tierRoleId);

  if (!baseTier) return null;
  return await baseTier.getNextTier();
};

const getPreviousTier = async (guildDiscordId, tierRoleId) => {
  await getGuildOrThrow(guildDiscordId, true);
  const baseTier = await getTierByRole(tierRoleId);

  if (!baseTier) return null;
  return await baseTier.getPreviousTier();
};

module.exports = {
  addTier,
  addRankedTier,
  addYuzuTier,
  getTier,
  getTiers,
  getNextTier,
  getPreviousTier,
};
