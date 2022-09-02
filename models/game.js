const { Client } = require("pg");
const { NotFoundError } = require("../errors/notFound");
const db = require("./db");
const { GamePlayer } = require("./gamePlayer");
const { Message, MESSAGE_TYPES } = require("./message");

const { StageBan } = require("./stageBan");

class Game {
  constructor({ id, num, stage_id, winner_id, gameset_id }) {
    this.id = id;
    this.num = num;
    this.stageId = stage_id;
    this.winnerId = winner_id;
    this.gamesetId = gameset_id;
  }

  getGamePlayer = async (playerId, client = null) => {
    const gp = await db.getBy("game_player", { game_id: this.id, player_id: playerId }, client);
    if (gp == null) return null;
    else return new GamePlayer(gp);
  };

  getGameset = async (client = null) => {
    const { getGameset: getGamesetGs } = require("./gameset");
    return getGamesetGs(this.gamesetId, client);
  };

  getGamePlayers = async (client = null) => {
    const gps = await db.filterBy("game_player", { game_id: this.id }, client);
    return gps.map((row) => new GamePlayer(row));
  };

  /**
   * Get the character messages of this game
   * @param {Client} client Optional PG Client
   * @returns Array of char messages
   */
  getCharacterMessages = async (client = null) => {
    const gameset = await this.getGameset(client);

    const lobby = await gameset.getLobby(client);
    if (!lobby) throw NotFoundError("Lobby");

    const messages = await db.filterBy("message", {
      type: MESSAGE_TYPES.GAME_CHARACTER_SELECT,
      guild_id: lobby.guildId,
      lobby_id: lobby.id,
    });

    return messages.map((row) => new Message(row));
  };

  /**
   * Delete all character messages of this game from the database
   * @param {Client} client Optional PG Client
   */
  deleteCharacterMessages = async (client = null) => {
    const gameset = await this.getGameset(client);

    const lobby = await gameset.getLobby(client);
    if (!lobby) throw NotFoundError("Lobby");

    const deleteString = {
      text: `DELETE FROM message 
      WHERE type = $1
      AND guild_id = $2
      AND lobby_id = $3`,
      values: [MESSAGE_TYPES.GAME_CHARACTER_SELECT, lobby.guildId, lobby.id],
    };
    await db.deleteQuery(deleteString, client);
  };

  /**
   * Get the characters being played and their player discordId
   * @param {Client} client Optional PG Client
   * @returns Array of objects with two properties: playerDiscordId and characterName
   */
  getCharacters = async (client = null) => {
    const gameset = await this.getGameset(client);

    const lobby = await gameset.getLobby(client);
    if (!lobby) throw NotFoundError("Lobby");

    const getString = {
      text: `SELECT p.discord_id AS player_discord_id, c.name AS character_name
      FROM game_player gp
      INNER JOIN character c
        ON c.id = gp.character_id
      INNER JOIN player p
        ON p.id = gp.player_id
      WHERE gp.game_id = $1
      `,
      values: [this.id],
    };

    const result = await db.getQuery(getString, client, true);
    return result.map((res) => ({
      playerDiscordId: res.player_discord_id,
      characterName: res.character_name,
    }));
  };

  haveAllPicked = async (client = null) => {
    const getQuery = {
      text: `SELECT * FROM game_player      
      WHERE game_id = $1 
      AND character_id IS NULL`,
      values: [this.id],
    };

    const getResult = await db.getQuery(getQuery, client, true);
    return getResult.length === 0;
  };

  /**
   * Get the GamePlayer that is supposed to strike
   * @param {Client} client Optional PG client
   * @returns
   */
  getStriker = async (client = null) => {
    const striker = await db.getBy("game_player", { game_id: this.id, ban_turn: true }, client);
    if (striker == null) return null;
    else return new GamePlayer(striker);
  };

  /**
   * Get the banned stages
   * @param {Client} client Optional PG client
   * @returns
   */
  getBans = async (client = null) => {
    const bans = await db.filterBy("stage_ban", { game_id: this.id }, client);
    return bans.map((row) => new StageBan(row));
  };

  getWinner = async (client = null) => {
    const { getPlayer } = require("./player");
    return await getPlayer(this.winnerId, false, client);
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

  addPlayer = async (playerId, client = null) => {
    const insertQuery = {
      text: `
    INSERT INTO game_player(game_id, player_id)
    VALUES ($1, $2)
    `,
      values: [this.id, playerId],
    };

    await db.insertQuery(insertQuery, client);
    return this.getGamePlayer(playerId, client);
  };

  remove = async (client = null) => await db.basicRemove("game", this.id, false, client);
}

const getGame = async (gameId, client = null) => {
  const game = await db.basicGet("game", gameId, false, client);
  if (game == null) return null;
  else return new Game(game);
};

module.exports = {
  Game,
  getGame,
};
