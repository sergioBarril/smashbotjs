const db = require("./index");

const get = async (gameId, client = null) => await db.basicGet("game", gameId, false, client);

const getByNum = async (gameSetId, gameNum, client = null) => {
  const getQuery = {
    text: `SELECT * FROM game
    WHERE gameset_id = $1
      AND num = $2`,
    values: [gameSetId, gameNum],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getCurrent = async (gameSetId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM game
    WHERE gameset_id = $1
    ORDER BY num DESC
    LIMIT 1`,
    values: [gameSetId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const haveAllPicked = async (gameId, client = null) => {
  const getQuery = {
    text: `SELECT 1 FROM game
    INNER JOIN game_player gp
      ON gp.game_id = game.id
    WHERE game.id = $1 
    AND gp.character_id IS NULL`,
    values: [gameId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows.length === 0;
};

const create = async (gameSetId, gameNum, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO game(gameset_id, num)
    VALUES ($1, $2)
    `,
    values: [gameSetId, gameNum],
  };

  await (client ?? db).query(insertQuery);
};

module.exports = {
  get,
  getCurrent,
  getByNum,
  haveAllPicked,
  create,
};
