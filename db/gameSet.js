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

const getScore = async (gameSetId, client = null) => {
  const getQuery = {
    text: `SELECT p.discord_id AS discord_id,
      COUNT(game.winner_id) FILTER(WHERE p.id = game.winner_id) AS wins
    FROM game_player gp
    INNER JOIN game
      ON game.id = gp.game_id
    INNER JOIN player p
      ON p.id = gp.player_id
    WHERE game.gameset_id = $1
    GROUP BY p.discord_id`,
    values: [gameSetId],
  };
  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

module.exports = {
  get,
  getByPlayer,
  getByLobby,
  getScore,
  create,
};
