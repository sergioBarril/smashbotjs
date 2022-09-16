const guildDB = require("../db/guild");
const tierDB = require("../db/tier");
const { NotFoundError } = require("../errors/notFound");
const { getGuild } = require("../models/guild");
const { getTierByRole } = require("../models/tier");

const addTier = async (roleDiscordId, guildDiscordId, channelDiscordId, weight, threshold) => {
  // Add tier to DB
  const guild = await guildDB.get(guildDiscordId, true);

  await tierDB.create(roleDiscordId, channelDiscordId, guild.id, weight, threshold, false);
};

const addRankedTier = async (roleDiscordId, rankedRoleId) => {
  const tier = await tierDB.getByRole(roleDiscordId);
  await tierDB.setRankedRole(tier.id, rankedRoleId);
};

const addYuzuTier = async (yuzuDiscordId, parsecDiscordId, guildDiscordId, channelDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);

  // General yuzu tier
  await tierDB.create(null, channelDiscordId, guild.id, null, null, true);

  // Guild yuzu role
  await guildDB.setYuzuRole(guild.id, yuzuDiscordId);
  await guildDB.setParsecRole(guild.id, parsecDiscordId);
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

const setSearchMessage = async (tierDiscordId, searchMessageId) => {
  const tier = await tierDB.get(tierDiscordId, true);

  await tierDB.setSearchMessage(tier.id, searchMessageId);
};

const setYuzuSearchMessage = async (guildDiscordId, searchMessageId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  const tier = await tierDB.getYuzu(guild.id);

  await tierDB.setSearchMessage(tier.id, searchMessageId);
};

module.exports = {
  addTier,
  addRankedTier,
  addYuzuTier,
  getTier,
  getTiers,
  setSearchMessage,
  setYuzuSearchMessage,
};
