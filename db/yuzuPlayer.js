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

const create = async (playerId, guildId, yuzu, parsec, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO yuzu_player(player_id, guild_id, yuzu, parsec)
    VALUES ($1, $2, $3, $4)
    `,
    values: [playerId, guildId, yuzu, parsec],
  };

  await (client ?? db).query(insertQuery);
};

const setRole = async (playerId, guildId, type, value, client = null) => {
  const updateQuery = {
    text: `
    UPDATE yuzu_player
    SET ${type.toLowerCase()} = $1
    WHERE player_id = $2
    AND guild_id = $3
    `,
    values: [value, playerId, guildId],
  };

  await (client ?? db).query(updateQuery);
};

module.exports = {
  get,
  create,
  setRole,
};
