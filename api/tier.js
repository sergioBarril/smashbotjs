const guildDB = require("../db/guild");
const tierDB = require("../db/tier");

const addTier = async (
  roleDiscordId,
  guildDiscordId,
  channelDiscordId,
  weight,
  threshold
) => {
  // Add tier to DB
  const guild = await guildDB.get(guildDiscordId, true);

  await tierDB.create(
    roleDiscordId,
    channelDiscordId,
    guild.id,
    weight,
    threshold,
    false
  );
};

const addYuzuTier = async (
  yuzuDiscordId,
  parsecDiscordId,
  guildDiscordId,
  channelDiscordId
) => {
  const guild = await guildDB.get(guildDiscordId, true);

  // General yuzu tier
  await tierDB.create(null, channelDiscordId, guild.id, null, null, true);

  // Guild yuzu role
  await guildDB.setYuzuRole(guild.id, yuzuDiscordId);
  await guildDB.setParsecRole(guild.id, parsecDiscordId);
};

const getTiers = async (guildDiscordId) => {
  const tiers = await tierDB.getByGuild(guildDiscordId, true);

  const weighted = tiers.filter((tier) => tier.weight !== null);
  const open = tiers.filter((tier) => tier.weight === null);

  return { weighted, open };
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
  addYuzuTier,
  getTiers,
  setSearchMessage,
  setYuzuSearchMessage,
};
