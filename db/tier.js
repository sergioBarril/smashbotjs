const db = require("./index");
const guildDB = require("./guild");

const get = async (tierId, discord = false) => await db.basicGet("tier", tierId, discord);

const getBySearchMessage = async (messageDiscordId) => {
  const getQuery = {
    text: `
    SELECT * FROM tier
    WHERE search_message_id = $1
    `,
    values: [messageDiscordId],
  };

  const getResult = await db.query(getQuery);
  return getResult.rows ? getResult.rows[0] : null;
};

const getByChannel = async (channelDiscordId, client = null) => {
  const getQuery = {
    text: `
    SELECT * from tier
    WHERE channel_id = $1
    `,
    values: [channelDiscordId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows?.length > 0 ? getResult.rows[0] : null;
};

const getByGuild = async (guildId, discord = false, client = null) => {
  if (discord) {
    const guild = await guildDB.get(guildId, true, client);
    guildId = guild.id;
  }

  const getQuery = {
    text: `
    SELECT * FROM tier
    WHERE guild_id = $1
    ORDER BY weight ASC
  `,
    values: [guildId],
  };

  const getResult = await (client ?? db).query(getQuery);

  return getResult.rows;
};

const getYuzu = async (guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT * FROM tier
    WHERE guild_id = $1
    AND yuzu
    `,
    values: [guildId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getByTierMessage = async (messageDiscordId, client = null) => {
  const getQuery = {
    text: `SELECT t.*
    FROM lobby_tier lt
    INNER JOIN tier t
      ON t.id = lt.tier_id
    WHERE lt.message_id = $1`,
    values: [messageDiscordId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const create = async (
  roleDiscordId,
  channelDiscordId,
  guildId,
  weight,
  threshold,
  yuzu,
  client = null
) => {
  const insertQuery = {
    text: `
    INSERT INTO tier(discord_id, channel_id, guild_id, weight, threshold, yuzu)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
    values: [roleDiscordId, channelDiscordId, guildId, weight, threshold, yuzu],
  };

  await (client ?? db).query(insertQuery);
};

const setSearchMessage = async (tierId, searchMessageId, client = null) => {
  const updateQuery = {
    text: `
    UPDATE tier
    SET search_message_id = $1
    WHERE id = $2
    `,
    values: [searchMessageId, tierId],
  };

  await (client ?? db).query(updateQuery);
};

module.exports = {
  get,
  getYuzu,
  getBySearchMessage,
  getByTierMessage,
  getByChannel,
  getByGuild,
  create,
  setSearchMessage,
};
