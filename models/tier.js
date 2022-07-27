const db = require("./db");

class Tier {
  constructor({
    id,
    channel_id,
    guild_id,
    threshold = null,
    discord_id,
    weight = null,
    search_message_id = null,
    yuzu = false,
    ranked_role_id = null,
  }) {
    this.id = id;
    this.channelId = channel_id;
    this.guildId = guild_id;

    this.threshold = threshold; // upper score limit of this tier
    this.roleId = discord_id; // discordId of @Tier X
    this.weight = weight; // the number of the tier. Tier n => Weight n
    this.searchMessageId = search_message_id; // message on the matchmaking channel
    this.yuzu = yuzu; // is this a yuzu/parsec tier
    this.rankedRoleId = ranked_role_id; // discordId of @Tier X (Ranked)
  }

  canSearchIn = (targetTier) => {
    // Can someone with this as their highest tier search in targetTier?
    if (!targetTier) return false;
    return targetTier.weight == null || targetTier.weight >= this.weight;
  };

  setSearchMessage = async (newSearchMessageId, client = null) => {
    await updateBy({ search_message_id: newSearchMessageId }, this.id, client);
    this.searchMessageId = newSearchMessageId;
  };

  setRankedRole = async (newRankedRoleId, client = null) => {
    await updateBy({ ranked_role_id: newRankedRoleId }, this.id, client);
    this.rankedRoleId = newRankedRoleId;
  };
}

const getTier = async (tierId, discord = false) => {
  const tier = await db.basicGet("tier", tierId, discord);
  if (tier == null) return null;
  else return new Tier(tier);
};

const getBy = async (dbFieldName, value, client = null) => {
  const tier = await db.getBy("tier", { [dbFieldName]: value }, client);
  if (tier == null) return null;
  else return new Tier(tier);
};

const getTierByRankedRole = async (rankedRoleId, client = null) =>
  await getBy("ranked_role_id", rankedRoleId, client);

const getTierBySearchMessage = async (messageDiscordId, client = null) => {
  if (messageDiscordId == null) return null;
  const { Message } = require("./message");

  const message = await db.getBy("message", { discord_id: messageDiscordId.toString() });
  if (message == null) return null;

  const messageObj = new Message(message);
  return await messageObj.getTier(client);
};

const getTierByChannel = async (channelDiscordId, client = null) =>
  await getBy("channel_id", channelDiscordId, client);

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

const insertTier = async ({
  roleDiscordId,
  channelDiscordId,
  guildId,
  weight,
  threshold = null,
  yuzu = false,
  client = null,
}) => {
  const insertQuery = {
    text: `
    INSERT INTO tier(discord_id, channel_id, guild_id, weight, threshold, yuzu)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
    values: [roleDiscordId, channelDiscordId, guildId, weight, threshold, yuzu],
  };

  await db.insertQuery(insertQuery, client);
};

// Basic update, only Where condition is id check
const updateBy = async (setDict, tierId, client = null) => {
  db.updateBy("tier", setDict, { id: tierId }, client);
};

module.exports = {
  getTier,
  getTierByRankedRole,
  getTierBySearchMessage,
  getTierByTierMessage,
  getTierByChannel,
  insertTier,
  Tier,
};
