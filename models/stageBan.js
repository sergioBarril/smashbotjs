const db = require("./db");

class StageBan {
  constructor({ player_id, game_id, stage_id }) {
    this.playerId = player_id;
    this.gameId = game_id;
    this.stageId = stage_id;
  }
}

const insertBan = async (gameId, playerId, stageId, client = null) => {
  const insertQuery = {
    text: `INSERT INTO stage_ban(player_id, game_id, stage_id)
    VALUES($1, $2, $3)`,
    values: [playerId, gameId, stageId],
  };

  await db.insertQuery(insertQuery, client);
};

//   Game method

module.exports = {
  insertBan,
  StageBan,
};
