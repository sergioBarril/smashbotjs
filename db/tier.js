const db = require("./index");

const get = async (tierId, discord = false) =>
  await db.basicGet("tier", tierId, discord);

const getByMessage = async (messageDiscordId) => {
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

const create = async (
  roleDiscordId,
  channelDiscordId,
  guildId,
  weight,
  threshold,
  client = null
) => {
  const insertQuery = {
    text: `
    INSERT INTO tier(discord_id, channel_id, guild_id, weight, threshold)
    VALUES ($1, $2, $3, $4, $5)
  `,
    values: [roleDiscordId, channelDiscordId, guildId, weight, threshold],
  };

  await (client ?? db).query(insertQuery);
};

module.exports = {
  get,
  getByMessage,
  getByChannel,
  create,
};
