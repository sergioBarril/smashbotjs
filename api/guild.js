const guildDB = require("../db/guild");

const getGuild = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  return guild;
};

const setMatchmakingChannel = async (guildDiscordId, searchChannelId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  await guildDB.setMatchmakingChannel(guild.id, searchChannelId);
};

module.exports = { getGuild, setMatchmakingChannel };
