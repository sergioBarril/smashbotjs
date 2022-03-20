const db = require("./index");

const get = async (gameSetId, client = null) =>
  await db.basicGet("gameset", gameSetId, false, client);

const getByLobby = async (lobbyId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM gameset
    WHERE lobby_id = $1`,
    values: [lobbyId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getByPlayer = async (playerId, client = null) => {
  const getQuery = {
    text: `SELECT gs.* FROM gameset gs
    INNER JOIN game
      ON game.gameset_id = gs.id
    INNER JOIN game_player gp
      ON gp.game_id = game.id
    WHERE gp.player_id = $1
    AND gs.winner IS NULL`,
    values: [playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const create = async (guildId, lobbyId, firstTo, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO gameset(guild_id, lobby_id, first_to)
    VALUES ($1, $2, $3)
    `,
    values: [guildId, lobbyId, firstTo],
  };

  await (client ?? db).query(insertQuery);
};

module.exports = {
  get,
  getByPlayer,
  getByLobby,
  create,
};
