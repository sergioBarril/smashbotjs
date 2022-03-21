const db = require("./index");

const ban = async (gameId, playerId, stageId, client = null) => {
  const insertQuery = {
    text: `INSERT INTO stage_ban(player_id, game_id, stage_id)
    VALUES($1, $2, $3)`,
    values: [playerId, gameId, stageId],
  };

  await (client ?? db).query(insertQuery);
};

const getBans = async (gameId, client = null) => {
  const getQuery = {
    text: `SELECT sb.player_id, stage.name
    FROM stage_ban sb
    INNER JOIN stage
      ON stage.id = sb.stage_id
    WHERE sb.game_id = $1`,
    values: [gameId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

module.exports = {
  ban,
  getBans,
};
