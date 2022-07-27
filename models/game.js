const db = require("./db");
const { GamePlayer } = require("./gamePlayer");
const { Message } = require("./message");
const { StageBan } = require("./stageBan");

class Game {
  constructor({ id, num, stage_id, winner_id, gameset_id }) {
    this.id = id;
    this.num = num;
    this.stageId = stage_id;
    this.winnerId = winner_id;
    this.gameSetId = gameset_id;
  }

  getGamePlayer = async (playerId, client = null) => {
    const gp = await db.getBy("game_player", { game_id: this.id, player_id: playerId }, client);
    if (gp == null) return null;
    else return new GamePlayer(gp);
  };

  getGamePlayers = async (client = null) => {
    const gps = await db.filterBy("game_player", { game_id: this.id }, client);
    return gps.map((row) => new GamePlayer(row));
  };

  getCharMessages = async (client = null) => {
    const getQuery = {
      text: `
    SELECT m.* FROM message m
    INNER JOIN game_player gp
      ON gp.char_message_id = m.id
    WHERE gp.game_id = $1`,
      values: [this.id],
    };

    const messages = await db.getQuery(getQuery, client, true);
    return messages.map((row) => Message(row));
  };

  removeCharMessages = async (client = null) => {
    const deleteQuery = {
      text: `
      DELETE FROM message
      USING game_player
      WHERE message.id = game_player.char_message_id
      AND game_player.game_id = $1
      `,
      values: [this.id],
    };

    await db.deleteQuery(deleteQuery, client);
  };

  haveAllPicked = async (client = null) => {
    const getQuery = {
      text: `SELECT * FROM game_player gp      
      WHERE game.id = $1 
      AND character_id IS NULL`,
      values: [this.id],
    };

    const getResult = await db.getQuery(getQuery, client, true);
    return getResult.rows.length === 0;
  };

  getStriker = async (client = null) => {
    const striker = await db.getBy("game_player", { game_id: this.id, ban_turn: true }, client);
    if (striker == null) return null;
    else return new GamePlayer(striker);
  };

  getBans = async (client = null) => {
    const bans = await db.filterBy("stage_ban", { game_id: this.id }, client);
    return bans.map((row) => new StageBan(row));
  };

  getWinner = async (client = null) => {
    const { Player } = require("./player");
    if (this.winnerId == null) return null;
    const winner = await db.getBy("player", { id: this.winnerId }, client);

    if (winner == null) return null;
    else return new Player(winner);
  };

  calculateWinner = async (client = null) => {
    const getQuery = {
      text: `SELECT gp.*
    FROM game_player gp    
    WHERE gp.game_id = $1 
    AND winner
    AND EXISTS (
      SELECT 1 FROM game_player
      WHERE game_id = $1
      AND NOT winner
    )`,
      values: [this.id],
    };

    const winner = await db.getQuery(getQuery, client);
    if (winner == null) return null;
    else return new GamePlayer(winner);
  };

  setStage = async (stageId, client = null) => {
    await db.updateBy("game", { stage_id: stageId }, { id: this.id }, client);
    this.stageId = stageId;
  };

  setWinner = async (winnerId, client = null) => {
    await db.updateBy("game", { winner_id: winnerId }, { id: this.id }, client);
    this.winnerId = winnerId;
  };

  remove = async (client = null) => await db.basicRemove("game", this.id, false, client);
}

const getGame = async (gameId, client = null) => {
  const game = await db.basicGet("game", gameId, false, client);
  if (game == null) return null;
  else return new Game(game);
};

const insertGame = async (gameSetId, gameNum, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO game(gameset_id, num)
    VALUES ($1, $2)
    `,
    values: [gameSetId, gameNum],
  };
  await db.insertQuery(insertQuery, client);
};

module.exports = {
  Game,
  getGame,
  insertGame,
};
