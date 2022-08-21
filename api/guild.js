const { getGuild: getGuildByDiscord, Guild } = require("../models/guild");

/**
 * Returns the Guild Model
 * @param {string} guildDiscordId DiscordId of the guild
 * @returns {Promise<Guild>} Guild model
 */
const getGuild = async (guildDiscordId) => getGuildByDiscord(guildDiscordId, true);

/**
 * Sets the #roles channel
 * @param {string} guildDiscordId DiscordId of the guild
 * @param {*} channelId DiscordID of the channel
 */
const setRolesChannel = async (guildDiscordId, channelId) => {
  const guild = await getGuild(guildDiscordId);
  await guild.setRolesChannel(channelId);
};

/**
 * Returns the Wifi Tier
 * @param {string} guildDiscordId DiscordID of the guild
 * @returns {Promise<Tier>} Wifi Tier
 */
const getWifiTier = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  return await guild.getWifiTier();
};

const getMatchmakingChannel = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  return guild.search_channel_id;
};

const setMatchmakingChannel = async (guildDiscordId, searchChannelId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  await guildDB.setMatchmakingChannel(guild.id, searchChannelId);
};

const getRankedChannel = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  return guild.ranked_channel_id;
};

const setRankedChannel = async (guildDiscordId, rankedChannelId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  await guildDB.setRankedChannel(guild.id, rankedChannelId);
};

const getCurrentList = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  const playerList = await guildDB.getCurrentList(guild.id);
  const allTiers = await tierDB.getByGuild(guildDiscordId, true);

  const groupedList = {};

  allTiers.forEach((tier) => (groupedList[[tier.discord_id, tier.search_message_id]] = []));

  playerList.forEach(({ tier_id, player_id, message_id }) => {
    groupedList[[tier_id, message_id]].push(player_id);
  });

  return groupedList;
};

module.exports = {
  getGuild,
  setRolesChannel,
  getMatchmakingChannel,
  setMatchmakingChannel,
  getRankedChannel,
  setRankedChannel,
  getCurrentList,
  getWifiTier,
};
