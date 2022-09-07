const db = require("./db");
const { Game } = require("./game");

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
    ranked,
  }) {
    this.id = id;
    this.createdAt = created_at;
    this.finishedAt = finished_at;
    this.firstTo = first_to;
    this.guildId = guild_id;
    this.lobbyId = lobby_id;
    this.winnerId = winner_id;
    this.isSurrender = is_surrender;
    this.ranked = ranked;
  }

  getGameByNum = async (gameNum, client = null) => {
    const game = await db.getBy("game", { gameset_id: this.id, num: gameNum }, client);
    if (game == null) return null;
    else return new Game(game);
  };

  getLobby = async (client = null) => {
    const { Lobby } = require("./lobby");
    if (this.lobbyId == null) return null;

    const lobby = await db.getBy("lobby", { id: this.lobbyId }, client);
    if (lobby == null) return null;
    else return new Lobby(lobby);
  };

  getCurrentGame = async (client = null) => {
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
      text: `SELECT gp.player_id AS player_id,
      COUNT(game.winner_id) FILTER(WHERE gp.player_id = game.winner_id) AS wins
      FROM game_player gp
      INNER JOIN game
      ON game.id = gp.game_id      
      WHERE game.gameset_id = $1
      GROUP BY gp.player_id`,
      values: [this.id],
    };

    const scoreResults = await db.getQuery(getQuery, client, true);
    const { getPlayer } = require("./player");
    return await Promise.all(
      scoreResults.map(async (row) => ({
        player: await getPlayer(row.player_id),
        wins: parseInt(row.wins),
      }))
    );
  };

  setWinner = async (winnerId, client = null) => {
    await db.updateBy("gameset", { winner_id: winnerId }, { id: this.id }, client);
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

  setSurrender = async (client = null) => {
    const setDict = { is_surrender: true };
    const whereCondition = { id: this.id };

    await db.updateBy("gameset", setDict, whereCondition, client);

    this.isSurrender = true;
  };

  newGame = async (client = null) => {
    let currentGame = await this.getCurrentGame(client);
    const gameNum = (currentGame?.num ?? 0) + 1;
    const insertQuery = {
      text: `
    INSERT INTO game(gameset_id, num)
    VALUES ($1, $2)
    `,
      values: [this.id, gameNum],
    };
    await db.insertQuery(insertQuery, client);

    return await this.getCurrentGame(client);
  };

  remove = async (client = null) => await db.basicRemove("gameset", this.id, false, client);
}

const getGameset = async (gameSetId, client = null) => {
  const gameset = await db.basicGet("gameset", gameSetId, false, client);
  if (gameset == null) return null;
  else return new Gameset(gameset);
};

module.exports = {
  Gameset,
  getGameset,
};
