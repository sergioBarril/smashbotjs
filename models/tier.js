const db = require("./db");

class Tier {
  constructor({
    id,
    channel_id,
    guild_id,
    threshold = null,
    role_id,
    weight = null,
    matchmaking_message_id = null,
    yuzu = false,
    ranked_role_id = null,
  }) {
    this.id = id;
    this.channelId = channel_id;
    this.guildId = guild_id;

    this.threshold = threshold; // upper score limit of this tier
    this.roleId = role_id; // discordId of @Tier X
    this.weight = weight; // the number of the tier. Tier n => Weight n
    this.matchmakingMessageId = matchmaking_message_id; // message on the matchmaking channel
    this.yuzu = yuzu; // is this a yuzu/parsec tier
    this.rankedRoleId = ranked_role_id; // discordId of @Tier X (Ranked)
  }

  canSearchIn = (targetTier) => {
    // Can someone with this as their highest tier search in targetTier?
    if (!targetTier) return false;
    const targetHasMoreWeight = targetTier.weight >= this.weight && this.weight !== null;
    return targetTier.weight === null || targetHasMoreWeight;
  };

  setMatchmakingMessage = async (newMMmessageId, client = null) => {
    await db.updateBy("tier", { matchmaking_message_id: newMMmessageId }, { id: this.id }, client);
    this.matchmakingMessageId = newMMmessageId;
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

const getTierBySearchMessage = async (messageDiscordId, client = null) => {
  if (messageDiscordId == null) return null;
  const { Message } = require("./message");

  const message = await db.getBy("message", { discord_id: messageDiscordId.toString() });
  if (message == null) return null;

  const messageObj = new Message(message);
  return await messageObj.getTier(client);
};

const getTierByTierMessage = async (messageDiscordId, client = null) => {
  const getQuery = {
    text: `SELECT t.*
    FROM lobby_tier lt
    INNER JOIN tier t
      ON t.id = lt.tier_id
    WHERE lt.message_id = $1`,
    values: [messageDiscordId],
  };

  const tier = await db.getQuery(getQuery, client, false);
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
  return await getTierByRole(roleDiscordId);
};

module.exports = {
  Tier,
  getTier,
  getTierByRole,
  getTierByRankedRole,
  getTierBySearchMessage,
  getTierByTierMessage,
  getTierByChannel,
  insertTier,
};
