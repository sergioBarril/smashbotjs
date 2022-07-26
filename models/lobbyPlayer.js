const db = require("./db");
const { getLobby } = require("./lobby");
const { getMessage } = require("./message");
const { getPlayer } = require("./player");

class LobbyPlayer {
  constructor({ lobby_id, player_id, status, message_id, new_set, cancel_set }) {
    this.lobbyId = lobby_id;
    this.playerId = player_id;

    this.status = status;
    this.messageId = message_id;

    this.newSet = new_set;
    this.cancelSet = cancel_set;
  }

  getPlayer = async (client = null) => {
    const player = await getPlayer(this.playerId, false, client);
    return player;
  };

  getOpponent = async (client = null) => {
    const getQuery = {
      text: `SELECT lobby_player.*
    FROM lobby_player
    INNER JOIN player
      ON player.id = lobby_player.player_id
    WHERE lobby_player.lobby_id = $1
    AND lobby_player.player_id <> $2`,
      values: [this.lobbyId, this.playerId],
    };

    const opponent = await db.getQuery(getQuery, client, false);
    if (opponent == null) return null;
    else return new LobbyPlayer(opponent);
  };

  getLobby = async (client = null) => {
    const lobby = await getLobby(this.lobbyId, client);
    return lobby;
  };

  getMessage = async (client = null) => {
    const message = await getMessage(this.messageId, client);
    return message;
  };

  setStatus = async (status, client = null) => {
    const whereConditions = { lobby_id: this.lobbyId, player_id: this.playerId };
    await db.updateBy("lobby_player", { status }, whereConditions, client);
    this.status = status;
  };

  setMessage = async (messageId, client = null) => {
    const whereConditions = { lobby_id: this.lobbyId, player_id: this.playerId };
    await db.updateBy("lobby_player", { message_id: messageId }, whereConditions, client);
    this.messageId = messageId;
  };

  setNewSet = async (newSet, client = null) => {
    const whereConditions = { lobby_id: this.lobbyId, player_id: this.playerId };
    await db.updateBy("lobby_player", { new_set: newSet }, whereConditions, client);
    this.newSet = newSet;
  };

  setCancelSet = async (cancelSetVote, client = null) => {
    const whereConditions = { lobby_id: this.lobbyId, player_id: this.playerId };
    await db.updateBy("lobby_player", { cancel_set: cancelSetVote }, whereConditions, client);
    this.cancelSet = cancelSetVote;
  };
}

const insert = async (lobbyId, playerId, status, client = null) => {
  const insertLobbyPlayerQuery = {
    text: `
    INSERT INTO lobby_player(lobby_id, player_id, status)
    VALUES ($1, $2, $3)
    `,
    values: [lobbyId, playerId, status],
  };

  await db.insertQuery(insertLobbyPlayerQuery, client);
  return true;
};

module.exports = {
  insert,
  getMessage,
  LobbyPlayer,
};
