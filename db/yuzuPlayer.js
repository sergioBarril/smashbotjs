const db = require("./index");

const get = async (playerId, guildId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM yuzu_player
   WHERE player_id = $1 
   AND guild_id = $2`,
    values: [playerId, guildId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

module.exports = {
  get,
};
