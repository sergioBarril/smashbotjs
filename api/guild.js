const { NotFoundError } = require("../errors/notFound");
const db = require("../models/db");
const { getGuild: getGuildByDiscord, Guild } = require("../models/guild");
const { insertMessage, MESSAGE_TYPES } = require("../models/message");
const { getPlayer } = require("../models/player");
const { getTierByRole, getTier } = require("../models/tier");

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

/**
 * Set the matchmaking channel of the guild
 * @param {string} guildDiscordId Discord ID of the guild
 * @param {string} matchmakingChannelId Discord ID of the matchmaking channel
 */
const setMatchmakingChannel = async (guildDiscordId, matchmakingChannelId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw NotFoundError("Guild");

  await guild.setMatchmakingChannel(matchmakingChannelId);
};

const getRankedChannel = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw NotFoundError("Guild");
  return guild.rankedChannelId;
};

/**
 * Set the ranked channel of the guild
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} rankedChannelId DiscordID of the ranked channel
 */
const setRankedChannel = async (guildDiscordId, rankedChannelId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw NotFoundError("Guild");

  await guild.setRankedChannel(rankedChannelId);
};

/**
 * Get the leaderboard channel of the guild
 * @param {string} guildDiscordId Discord ID of the guild
 * @returns
 */
const getLeaderboardChannel = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw NotFoundError("Guild");
  return guild.leaderboardChannelId;
};

/**
 * Set the leaderboard channel of the guild
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} leaderboardChannelId DiscordID of the leaderboard channel
 */
const setLeaderboardChannel = async (guildDiscordId, leaderboardChannelId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw NotFoundError("Guild");

  await guild.setLeaderboardChannel(leaderboardChannelId);
};

/**
 * Get the message that shows the current state of the queues
 * @param {string} guildDiscordId DiscordID of the guild
 * @returns Message to show
 */
const getCurrentList = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  const lobbies = await guild.getLobbies();

  // SEARCHING LOBBIES
  const searchingLobbies = lobbies.filter((lobby) => lobby.status === "SEARCHING");
  let searching = [];
  let ranked = [];

  for (let lobby of searchingLobbies) {
    const owner = await getPlayer(lobby.createdBy, false);

    let lts = await lobby.getLobbyTiers();
    let tiers = await Promise.all(lts.map(async (lt) => lt.getTier()));

    tiers.forEach((tier) => {
      searching.push({
        player: owner,
        tier,
      });
    });

    if (lobby.ranked) {
      const rating = await owner.getRating(guild.id);
      const tier = await getTier(rating.tierId);
      ranked.push({
        player: owner,
        tier,
      });
    }
  }

  searching = searching.sort((a, b) => {
    if (a.tier.weight === b.tier.weight) return 0;
    if (a.tier.weight === null) return 1;
    if (b.tier.weight === null) return -1;
    return a.tier.weight - b.tier.weight;
  });

  // CONFIRMATION LOBBIES
  const confirmationLobbies = lobbies.filter((lobby) => lobby.status == "CONFIRMATION");
  const confirmation = [];

  for (let lobby of confirmationLobbies) {
    let lps = await lobby.getLobbyPlayers();
    let players = await Promise.all(
      lps.map(async (lp) => {
        const player = await lp.getPlayer();
        return { player, accepted: lp.status === "ACCEPTED", ranked: lobby.mode == "RANKED" };
      })
    );

    confirmation.push(players);
  }

  // PLAYING LOBBIES
  const playingLobbies = lobbies.filter((lobby) => lobby.status === "PLAYING");
  const playing = [];

  for (let lobby of playingLobbies) {
    let lps = await lobby.getLobbyPlayers();
    let players = await Promise.all(lps.map(async (lp) => lp.getPlayer()));

    playing.push(players);
  }

  return { ranked, searching, confirmation, playing };
};

/**
 * Inserts a new Matchmaking message to the Database
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} messageDiscordId DiscordId of the new MM message
 * @param {string} tierRoleId DiscordID of the role tier
 * @param {boolean} yuzu True if it's the button for the yuzu Tier
 * @param {boolean} wifi True if it's the button for the wifi Tier
 * @param {boolean} isRankedChannel True if the message goes to #ranked
 */
const insertMatchmakingMessage = async (
  guildDiscordId,
  messageDiscordId,
  tierRoleId,
  yuzu = false,
  wifi = false,
  ranked = false,
  isRankedChannel = false
) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  let tier;
  if (tierRoleId) tier = await getTierByRole(tierRoleId);
  else if (yuzu) tier = await guild.getYuzuTier();
  else if (wifi) tier = await guild.getWifiTier();
  if (!ranked && !tier) throw new NotFoundError("Tier");

  if (ranked) await guild.insertRankedMessage(messageDiscordId, isRankedChannel);
  else await guild.insertMatchmakingMessage(messageDiscordId, tier.id);
};

/**
 * Inserts a new Matchmaking list message to the database
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} messageDiscordId DiscordID of the list message
 */
const insertListMessage = async (guildDiscordId, messageDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  await guild.insertListMessage(messageDiscordId);
};

/**
 * Inserts a new Leaderboard message to the database
 * @param {string} guildDiscordId DiscordID of the guild
 * @param {string} messageDiscordId DiscordID of the leaderboard message
 */
const insertLeaderboardMessage = async (guildDiscordId, messageDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  await guild.insertLeaderboardMessage(messageDiscordId);
};

/**
 * Removes all messages of the channel #matchmaking,
 * so message_types = GUILD_TIER_SEARCH and GUILD_CURRENT_LIST
 * @param {string} guildDiscordId DiscordID of the guild
 */
const removeAllGuildSearchMessages = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  await guild.removeMatchmakingMessages();
};

const removeRankedChannelMessages = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  await db.deleteQuery({
    text: "DELETE FROM message WHERE channel_id = $1",
    values: [guild.rankedChannelId],
  });
};

/**
 * Remove the Leaderboard messages from the DB
 * @param {string} guildDiscordId DiscordID of the guild
 */
const removeLeaderboardMessages = async (guildDiscordId) => {
  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  await db.deleteQuery({
    text: "DELETE FROM message WHERE channel_id = $1",
    values: [guild.leaderboardChannelId],
  });
};

module.exports = {
  getGuild,
  setRolesChannel,
  setMatchmakingChannel,
  getRankedChannel,
  setRankedChannel,
  getLeaderboardChannel,
  setLeaderboardChannel,
  getCurrentList,
  getWifiTier,
  insertMatchmakingMessage,
  insertLeaderboardMessage,
  removeAllGuildSearchMessages,
  removeRankedChannelMessages,
  removeLeaderboardMessages,
  insertListMessage,
};
