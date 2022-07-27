const { getCharacterByName } = require("./character");
const { CharacterRole } = require("./characterRole");
const db = require("./db");
const { RegionRole } = require("./regionRole");
const { Tier } = require("./tier");

class Guild {
  constructor({
    id,
    discord_id,
    search_channel_id,
    admin_channel_id,
    yuzu_role_id,
    parsec_role_id,
    roles_channel_id,
    ranked_channel_id,
  }) {
    this.id = id;
    this.discordId = discord_id;

    this.searchChannelId = search_channel_id; // #matchmaking channel
    this.adminChannelId = admin_channel_id;
    this.rolesChannelId = roles_channel_id;
    this.rankedChannelId = ranked_channel_id;

    this.yuzuRoleId = yuzu_role_id;
    this.parsecRoleId = parsec_role_id;
  }

  // **********
  //  GETTERS
  // *********
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

  getCurrentList = async (client = null) => {
    const getQueryString = {
      text: `
      SELECT tier.discord_id AS tier_id, player.discord_id AS player_id, 
      tier.search_message_id AS message_id
      FROM tier
      INNER JOIN lobby_tier lt
      ON tier.id = lt.tier_id
      INNER JOIN lobby l
      ON l.id = lt.lobby_id
      INNER JOIN lobby_player lp
      ON lp.player_id = l.created_by
      INNER JOIN player
      ON player.id = lp.player_id
      WHERE tier.guild_id = $1
      `,
      values: [this.id],
    };
    const getResult = await db.getQuery(getQueryString, client, true);
    return getResult;
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
    const tier = await db.getBy("tier", { guild_id: this.guildId, yuzu: true }, client);
    if (tier == null) return null;
    else return new Tier(tier);
  };

  // *******
  // SETTERS
  // *******
  setMatchmakingChannel = async (channelId, client = null) =>
    await updateBy({ search_channel_id: channelId }, this.id, client);

  setRankedChannel = async (channelId, client = null) =>
    await updateBy({ ranked_channel_id: channelId }, this.id, client);
  setRolesChannel = async (channelId, client = null) =>
    await updateBy({ roles_channel_id: channelId }, this.id, client);
  setYuzuRole = async (yuzuRoleId, client = null) =>
    await updateBy({ yuzu_role_id: yuzuRoleId }, this.id, client);
  setParsecRole = async (parsecRoleId, client = null) =>
    await updateBy({ parsec_role_id: parsecRoleId }, this.id, client);
}

const getGuild = async (guildId, discord = false, client = null) => {
  const guild = await db.basicGet("guild", guildId, discord, client);
  if (guild == null) return null;
  else return new Guild(guild);
};

const updateBy = async (dictSet, guildId, client = null) => {
  await db.updateBy("guild", setPairs, { id: guildId }, client);
};

module.exports = {
  getGuild,
  Guild,
};
