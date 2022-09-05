const { Client } = require("pg");
const { getCharacterByName } = require("./character");
const { CharacterRole } = require("./characterRole");
const db = require("./db");
const { insertMessage, MESSAGE_TYPES, Message } = require("./message");
const { getRegionByName } = require("./region");
const { RegionRole } = require("./regionRole");
const { Tier } = require("./tier");

class Guild {
  constructor({
    id,
    discord_id,
    matchmaking_channel_id,
    admin_channel_id,
    yuzu_role_id,
    parsec_role_id,
    roles_channel_id,
    ranked_channel_id,
  }) {
    this.id = id;
    this.discordId = discord_id;

    this.matchmakingChannelId = matchmaking_channel_id;
    this.adminChannelId = admin_channel_id;
    this.rolesChannelId = roles_channel_id;
    this.rankedChannelId = ranked_channel_id;

    this.yuzuRoleId = yuzu_role_id;
    this.parsecRoleId = parsec_role_id;
  }

  // **********
  //  GETTERS
  // *********

  /**
   * Return the tiers, ordered from less weight (tier 1)
   * to more (tier 4)
   * @param {Client} client Optional pg client
   * @returns {Promise<Array<Tier>>}
   */
  getTiers = async (client = null) => {
    const queryString = {
      text: `
      SELECT * FROM tier
      WHERE guild_id = $1
      ORDER BY weight ASC
      `,
      values: [this.id],
    };

    const getResult = await db.getQuery(queryString, client, true);
    return getResult.map((row) => new Tier(row));
  };

  /**
   * Inserts new message to the DB, of the type GUILD_CURRENT_LIST
   * @param {string} listMessageId DiscordID of the new List message
   * @param {Client} client Optional PG client
   * @returns
   */
  insertListMessage = async (listMessageId, client = null) => {
    return insertMessage(
      listMessageId,
      MESSAGE_TYPES.GUILD_CURRENT_LIST,
      null,
      this.matchmakingChannelId,
      null,
      this.id,
      null,
      null,
      client
    );
  };

  /**
   * Returns the list message of this guild
   * @param {Client} client Optional PG client
   * @returns {Promise<Message>}
   */
  getListMessage = async (client = null) => {
    const message = await db.getBy("message", {
      guild_id: this.id,
      type: MESSAGE_TYPES.GUILD_CURRENT_LIST,
    });

    if (!message) return null;
    else return new Message(message);
  };

  /**
   * Inserts new message to the DB, of type GUILD_TIER_SEARCH
   * @param {string} messageDiscordId DiscordID of the new matchmaking message
   * @param {string} tierId ID of the tier (not roleId) associated with the message
   * @param {Client} client Optional PG client
   */
  insertMatchmakingMessage = async (messageDiscordId, tierId, client = null) => {
    await insertMessage(
      messageDiscordId,
      MESSAGE_TYPES.GUILD_TIER_SEARCH,
      tierId,
      this.matchmakingChannelId,
      null,
      this.id,
      null,
      null,
      client
    );
  };

  /**
   * Inserts new message to the DB, of type GUILD_RANKED_SEARCH
   * @param {string} messageDiscordId DiscordID of the new matchmaking message
   * @param {boolean} isRankedChannel True if this message is from the ranked channel
   * @param {Client} client Optional PG client
   */
  insertRankedMessage = async (messageDiscordId, isRankedChannel = false, client = null) => {
    await insertMessage(
      messageDiscordId,
      MESSAGE_TYPES.GUILD_RANKED_SEARCH,
      null,
      isRankedChannel ? this.rankedChannelId : this.matchmakingChannelId,
      null,
      this.id,
      null,
      null,
      client
    );
  };

  /**
   * Removes all messages of the channel #matchmaking,
   * so message_types = GUILD_TIER_SEARCH and GUILD_CURRENT_LIST and GUILD_RANKED_SEARCH
   * @param {Client} client Optional PG Client
   */
  removeMatchmakingMessages = async (client = null) => {
    const deleteQuery = {
      text: `DELETE FROM message
      WHERE guild_id = $1
      AND (type = $2 OR type = $3 OR type = $4)
      AND channel_id = $5`,
      values: [
        this.id,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        MESSAGE_TYPES.GUILD_CURRENT_LIST,
        MESSAGE_TYPES.GUILD_RANKED_SEARCH,
        this.matchmakingChannelId,
      ],
    };

    await db.deleteQuery(deleteQuery, client);
  };

  getCharacterRoles = async (client = null) => {
    const charRoles = await db.filterBy("character_role", { guild_id: this.id }, client);
    return charRoles.map((row) => new CharacterRole(row));
  };

  getCharacterRoleByName = async (charName, client = null) => {
    const character = await getCharacterByName(charName, client);
    if (character == null) return null;

    return await character.getRole(this.id, client);
  };

  getRegionRoleByName = async (regionName, client = null) => {
    const region = await getRegionByName(regionName, client);
    if (region == null) return null;

    return await region.getRole(this.id, client);
  };

  getRegionRoles = async (client = null) => {
    const regionRoles = await db.filterBy("region_role", { guild_id: this.id }, client);
    return regionRoles.map((row) => new RegionRole(row));
  };

  getYuzuTier = async (client = null) => {
    const tier = await db.getBy("tier", { guild_id: this.id, yuzu: true }, client);
    if (tier == null) return null;
    else return new Tier(tier);
  };

  getWifiTier = async (client = null) => {
    const tier = await db.getBy("tier", { guild_id: this.id, wifi: true }, client);
    if (tier == null) return null;
    else return new Tier(tier);
  };

  /**
   * Get all lobbies happening in this guild
   * @param {Client} client Optional pg Client
   * @returns {Promise<Array<Lobby>>} Array of lobbies
   */
  getLobbies = async (client = null) => {
    const { Lobby } = require("./lobby");
    let lobbies = await db.filterBy("lobby", { guild_id: this.id }, client);
    return lobbies.map((lobby) => new Lobby(lobby));
  };

  // *******
  // SETTERS
  // *******
  setMatchmakingChannel = async (channelId, client = null) => {
    await db.updateBy("guild", { matchmaking_channel_id: channelId }, { id: this.id }, client);
    this.matchmakingChannelId = channelId;
  };

  setRankedChannel = async (channelId, client = null) => {
    await db.updateBy("guild", { ranked_channel_id: channelId }, { id: this.id }, client);
    this.rankedChannelId = channelId;
  };

  setRolesChannel = async (channelId, client = null) => {
    await db.updateBy("guild", { roles_channel_id: channelId }, { id: this.id }, client);
    this.rolesChannelId = channelId;
  };

  setYuzuRole = async (yuzuRoleId, client = null) => {
    await db.updateBy("guild", { yuzu_role_id: yuzuRoleId }, { id: this.id }, client);
    this.yuzuRoleId = yuzuRoleId;
  };

  setParsecRole = async (parsecRoleId, client = null) => {
    await db.updateBy("guild", { parsec_role_id: parsecRoleId }, { id: this.id }, client);
    this.parsecRoleId = parsecRoleId;
  };

  remove = async (client = null) => await db.basicRemove("guild", this.id, false, client);
}

const getGuild = async (guildId, discord = false, client = null) => {
  const guild = await db.basicGet("guild", guildId, discord, client);
  if (guild == null) return null;
  else return new Guild(guild);
};

const getAllGuilds = async (client = null) => {
  const guilds = await db.getQuery({ text: "SELECT * FROM guild" }, client, true);
  return guilds.map((guild) => new Guild(guild));
};

const insertGuild = async (guildDiscordId, client) => {
  const insertQuery = {
    text: `
    INSERT INTO guild(discord_id)
    VALUES ($1)
  `,
    values: [guildDiscordId],
  };

  await db.insertQuery(insertQuery, client);
  return await getGuild(guildDiscordId, true, client);
};

module.exports = {
  Guild,
  getGuild,
  getAllGuilds,
  insertGuild,
};
