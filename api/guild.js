const guildDB = require("../db/guild");
const tierDB = require("../db/tier");

const getGuild = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  return guild;
};

const getRolesChannel = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  return guild.roles_channel_id;
};

const setRolesChannel = async (guildDiscordId, channelId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  await guildDB.setRolesChannel(guild.id, channelId);
};

const getMatchmakingChannel = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  return guild.search_channel_id;
};

const setMatchmakingChannel = async (guildDiscordId, searchChannelId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  await guildDB.setMatchmakingChannel(guild.id, searchChannelId);
};

const getCurrentList = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  const playerList = await guildDB.getCurrentList(guild.id);
  const allTiers = await tierDB.getByGuild(guildDiscordId, true);

  const groupedList = {};

  allTiers.forEach(
    (tier) => (groupedList[[tier.discord_id, tier.search_message_id]] = [])
  );

  playerList.forEach(({ tier_id, player_id, message_id }) => {
    groupedList[[tier_id, message_id]].push(player_id);
  });

  return groupedList;
};

module.exports = {
  getGuild,
  getRolesChannel,
  setRolesChannel,
  getMatchmakingChannel,
  setMatchmakingChannel,
  getCurrentList,
};
