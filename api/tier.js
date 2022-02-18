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
    threshold
  );
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

module.exports = { addTier, getTiers, setSearchMessage };
