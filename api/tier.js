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

module.exports = { addTier };
