const db = require("./index");

const get = async (guildId, discord = false, client = null) =>
  await db.basicGet("guild", guildId, discord, client);

const getByLobby = async (lobbyId, client = null) => {
  const getGuildQuery = {
    text: `
    SELECT guild.* FROM guild
    INNER JOIN lobby
    ON lobby.guild_id = guild.id
    WHERE lobby.id = $1
    `,
    values: [lobbyId],
  };

  const getGuildResult = await (client ?? db).query(getGuildQuery);
  if (getGuildResult.rows?.length > 0) return getGuildResult.rows[0];
  else return null;
};

const setMatchmakingChannel = async (guildId, channelId, client = null) => {
  const updateQuery = {
    text: `UPDATE guild
    SET search_channel_id = $1
    WHERE id = $2`,
    values: [channelId, guildId],
  };

  await (client ?? db).query(updateQuery);
};

module.exports = {
  get,
  getByLobby,
  setMatchmakingChannel,
};
