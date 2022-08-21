const { NotFoundError } = require("../errors/notFound");
const db = require("./db");
const { insertMessage, MESSAGE_TYPES, Message } = require("./message");

class Tier {
  constructor({
    id,
    channel_id,
    guild_id,
    threshold = null,
    role_id,
    weight = null,
    yuzu = false,
    wifi = false,
    ranked_role_id = null,
  }) {
    this.id = id;
    this.channelId = channel_id;
    this.guildId = guild_id;

    this.threshold = threshold; // upper score limit of this tier
    this.roleId = role_id; // discordId of @Tier X
    this.weight = weight; // the number of the tier. Tier n => Weight n
    this.yuzu = yuzu; // is this a yuzu/parsec tier
    this.wifi = wifi;
    this.rankedRoleId = ranked_role_id; // discordId of @Tier X (Ranked)
  }

  getGuild = async (client = null) => {
    const { getGuild } = require("./guild");
    return await getGuild(this.guildId, false, client);
  };

  canSearchIn = (targetTier) => {
    // Can someone with this as their highest tier search in targetTier?
    if (!targetTier) return false;
    const targetHasMoreWeight = targetTier.weight >= this.weight && this.weight !== null;
    return targetTier.weight === null || targetHasMoreWeight;
  };

  insertMessage = async (discordId, client = null) => {
    const guild = await this.getGuild(client);

    if (!guild.matchmakingChannelId) throw new NotFoundError("MatchmakingChannel");

    return await insertMessage(
      discordId,
      MESSAGE_TYPES.GUILD_TIER_SEARCH,
      this.id,
      guild.matchmakingChannelId,
      null,
      guild.id,
      null,
      false,
      client
    );
  };

  getMessage = async (client = null) => {
    const getResult = await db.getBy(
      "message",
      { tier_id: this.id, guild_id: this.guildId, type: MESSAGE_TYPES.GUILD_TIER_SEARCH },
      client
    );
    if (!getResult) return null;
    else return new Message(getResult);
  };

  setMessage = async (newDiscordId, client = null) => {
    await db.updateBy(
      "message",
      { discord_id: newDiscordId },
      { tier_id: this.id, guild_id: this.guildId, type: MESSAGE_TYPES.GUILD_TIER_SEARCH },
      client
    );
  };

  removeMessage = async (client = null) => {
    const message = await this.getMessage(client);
    if (message) await message.remove(client);
  };

  setRankedRole = async (newRankedRoleId, client = null) => {
    await db.updateBy("tier", { ranked_role_id: newRankedRoleId }, { id: this.id }, client);
    this.rankedRoleId = newRankedRoleId;
  };

  setChannel = async (newChannelId, client = null) => {
    await db.updateBy("tier", { channel_id: newChannelId }, { id: this.id }, client);
    this.channelId = newChannelId;
  };

  setThreshold = async (newThreshold, client = null) => {
    await db.updateBy("tier", { threshold: newThreshold }, { id: this.id }, client);
    this.threshold = newThreshold;
  };

  setWeight = async (newWeight, client = null) => {
    await db.updateBy("tier", { weight: newWeight }, { id: this.id }, client);
    this.weight = newWeight;
  };

  setWifi = async (newWifi, client = null) => {
    await db.updateBy("tier", { wifi: newWifi }, { id: this.id }, client);
    this.wifi = newWifi;
  };

  remove = async (client = null) => await db.basicRemove("tier", this.id, false, client);
}

const getTier = async (tierId, client = null) => {
  const tier = await db.basicGet("tier", tierId, false, client);
  if (tier == null) return null;
  else return new Tier(tier);
};

const getTierByRole = async (roleId, client = null) => {
  if (!roleId) return null;
  const tier = await db.getBy("tier", { role_id: roleId }, client);
  if (tier == null) return null;
  else return new Tier(tier);
};

const getTierByRankedRole = async (rankedRoleId, client = null) => {
  const tier = await db.getBy("tier", { ranked_role_id: rankedRoleId }, client);
  if (tier == null) return null;
  else return new Tier(tier);
};

const getTierByChannel = async (channelDiscordId, client = null) => {
  const tier = await db.getBy("tier", { channel_id: channelDiscordId }, client);
  if (tier == null) return null;
  else return new Tier(tier);
};

const insertTier = async (
  roleDiscordId,
  channelDiscordId,
  guildId,
  weight,
  threshold = null,
  yuzu = false,
  client = null
) => {
  const insertQuery = {
    text: `
    INSERT INTO tier(role_id, channel_id, guild_id, weight, threshold, yuzu)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
    values: [roleDiscordId, channelDiscordId, guildId, weight, threshold, yuzu],
  };

  await db.insertQuery(insertQuery, client);
  if (roleDiscordId) return await getTierByRole(roleDiscordId, client);
  else if (channelDiscordId) return await getTierByChannel(channelDiscordId, client);
};

module.exports = {
  Tier,
  getTier,
  getTierByRole,
  getTierByRankedRole,
  getTierByChannel,
  insertTier,
};
