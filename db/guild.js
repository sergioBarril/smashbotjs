const db = require("./index");

const get = async (guildId, discord = false) =>
  await db.basicGet("guild", guildId, discord);

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
module.exports = {
  get,
  getByLobby,
};
