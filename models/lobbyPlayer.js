const { Client } = require("pg");
const { NotFoundError } = require("../errors/notFound");
const db = require("./db");
const { getMessage, insertMessage, MESSAGE_TYPES } = require("./message");

class LobbyPlayer {
  constructor({ lobby_id, player_id, status, message_id, new_set, cancel_set, accepted_at }) {
    this.lobbyId = lobby_id;
    this.playerId = player_id;

    this.status = status;
    this.messageId = message_id;

    this.newSet = new_set;
    this.cancelSet = cancel_set;

    this.acceptedAt = accepted_at;
  }

  getPlayer = async (client = null) => {
    const { getPlayer } = require("./player");
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
    const { getLobby } = require("./lobby");
    const lobby = await getLobby(this.lobbyId, client);
    return lobby;
  };

  getMessage = async (client = null) => {
    const message = await getMessage(this.messageId, false, client);
    return message;
  };

  setStatus = async (status, client = null) => {
    const whereConditions = { lobby_id: this.lobbyId, player_id: this.playerId };
    await db.updateBy("lobby_player", { status }, whereConditions, client);
    this.status = status;
  };

  acceptMatch = async (client = null) => {
    const updateString = {
      text: `UPDATE lobby_player
      SET status = 'ACCEPTED',
      accepted_at = NOW()
      WHERE lobby_id = $1
      AND player_id = $2`,
      values: [this.lobbyId, this.playerId],
    };

    await db.updateQuery(updateString, client);
    this.status = "ACCEPTED";

    const lobby = await this.getLobby(client);
    const thisLp = await lobby.getLobbyPlayer(this.playerId, client);
    this.acceptedAt = thisLp.acceptedAt;
  };

  insertMessage = async (messageId, client = null) => {
    const lobby = await this.getLobby();
    if (!lobby) throw new NotFoundError("Lobby");

    return insertMessage(
      messageId,
      MESSAGE_TYPES.LOBBY_PLAYER,
      null,
      null,
      this.playerId,
      lobby.guildId,
      lobby.id,
      false,
      client
    );
  };

  /**
   * Removes all LOBBY_PLAYER messages from this LP
   * @param {Client} client Optional PG client
   */
  removeMessages = async (client = null) => {
    const deleteQuery = {
      text: `DELETE FROM message
      WHERE lobby_id = $1 AND player_id = $2
      AND type = $3`,
      values: [this.lobbyId, this.playerId, MESSAGE_TYPES.LOBBY_PLAYER],
    };

    await db.deleteQuery(deleteQuery, client);
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

  remove = async (client = null) =>
    await db.deleteQuery(
      {
        text: `DELETE FROM lobby_player WHERE lobby_id = $1 AND player_id = $2`,
        values: [this.lobbyId, this.playerId],
      },
      client
    );
}

module.exports = {
  LobbyPlayer,
  getMessage,
};
