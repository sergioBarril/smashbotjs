const db = require("./db");

class StageBan {
  constructor({ player_id, game_id, stage_id }) {
    this.playerId = player_id;
    this.gameId = game_id;
    this.stageId = stage_id;
  }
}

//   Game method

module.exports = {
  StageBan,
};
