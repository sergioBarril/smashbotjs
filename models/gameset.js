const db = require("./db");
const { Game } = require("./game");
const { Lobby } = require("./lobby");

class Gameset {
  constructor({
    id,
    created_at,
    finished_at,
    first_to,
    guild_id,
    lobby_id,
    winner_id,
    is_surrender,
  }) {
    this.id = id;
    this.createdAt = created_at;
    this.finishedAt = finished_at;
    this.firstTo = first_to;
    this.guildId = guild_id;
    this.lobbyId = lobby_id;
    this.winnerId = winner_id;
    this.isSurrender = is_surrender;
  }

  getGameByNum = async (gameNum, client = null) => {
    const game = await db.getBy("table", { gameset_id: this.id, num: gameNum }, client);
    if (game == null) return null;
    else return new Game(game);
  };

  getLobby = async (client = null) => {
    if (this.lobbyId == null) return null;

    const lobby = await db.getBy("lobby", { id: this.lobbyId }, client);
    if (lobby == null) return null;
    else return new Lobby(lobby);
  };

  getCurrent = async (client = null) => {
    const getQuery = {
      text: `SELECT * FROM game
    WHERE gameset_id = $1
    ORDER BY num DESC
    LIMIT 1`,
      values: [this.id],
    };

    const game = await db.getQuery(getQuery, client);
    if (game == null) return null;
    else return new Game(game);
  };

  getScore = async (client = null) => {
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
      values: [this.id],
    };

    const scoreResults = await db.getQuery(getQuery, client, true);
    return scoreResults;
  };

  setWinner = async (winnerId, client = null) => {
    await db.updateBy("gameset", { winnner_id: winnerId }, { id: this.id }, client);
    this.winnerId = winnerId;
  };

  setLobby = async (lobbyId, client = null) => {
    await db.updateBy("gameset", { lobby_id: lobbyId }, { id: this.id }, client);
    this.lobbyId = lobbyId;
  };

  setFinish = async (client = null) => {
    const updateQuery = {
      text: `UPDATE gameset
  SET finished_at = NOW()
  WHERE id = $1`,
      values: [this.id],
    };

    await db.updateQuery(updateQuery, client);
    this.finishedAt = Date.now();
  };

  setSurrender = async (winnerId, client = null) => {
    const setDict = { winner_id: winnerId, is_surrender: true };
    const whereCondition = { id: this.id };

    await db.updateBy("gameset", setDict, whereCondition, client);

    this.winnerId = winnerId;
    this.isSurrender = true;
  };

  remove = async (client = null) => await db.basicRemove("gameset", this.id, false, client);
}

const getGameset = async (gameSetId, client = null) => {
  const gameset = await db.basicGet("gameset", gameSetId, false, client);
  if (gameset == null) return null;
  else return new Gameset(gameset);
};

const insertGameset = async (guildId, lobbyId, firstTo, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO gameset(guild_id, lobby_id, first_to)
    VALUES ($1, $2, $3)
    `,
    values: [guildId, lobbyId, firstTo],
  };

  await db.insertQuery(insertQuery, client);
};

module.exports = {
  getGameset,
  insertGameset,
  Gameset,
};
