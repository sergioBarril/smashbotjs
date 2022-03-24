const db = require("./index");

const get = async (lobbyId, playerId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM lobby_player
    WHERE lobby_id = $1
    AND player_id = $2`,
    values: [lobbyId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const updateStatus = async (lobbyId, playerId, status, client = null) => {
  const updateStatusQuery = {
    text: `
    UPDATE lobby_player
    SET status = $1
    WHERE lobby_id = $2
    AND player_id = $3
    `,
    values: [status, lobbyId, playerId],
  };

  await (client ?? db).query(updateStatusQuery);

  return true;
};

const insert = async (lobbyId, playerId, status, client = null) => {
  const insertLobbyPlayerQuery = {
    text: `
    INSERT INTO lobby_player(lobby_id, player_id, status)
    VALUES ($1, $2, $3)
    `,
    values: [lobbyId, playerId, status],
  };

  await (client ?? db).query(insertLobbyPlayerQuery);
  return true;
};

const setMessage = async (playerId, messageId, client = null) => {
  const updateMessageQuery = {
    text: `
    UPDATE lobby_player SET message_id = $1
    WHERE player_id = $2`,
    values: [messageId, playerId],
  };

  await (client ?? db).query(updateMessageQuery);
  return true;
};

const getMessage = async (playerId, client = null) => {
  const getMessageQuery = {
    text: `
    SELECT DISTINCT message_id FROM lobby_player
    WHERE player_id = $1
    )`,
    values: [playerId],
  };

  const getMessageResult = await (client ?? db).query(getMessageQuery);
  if (getMessageResult.rows?.length > 0) return getMessageResult.rows[0].message_id;
  else return null;
};

const getLobbyPlayers = async (lobbyId, client = null) => {
  const getLobbyPlayersQuery = {
    text: `
    SELECT lobby_player.*, player.discord_id
    FROM lobby_player INNER JOIN player
    ON lobby_player.player_id = player.id
    WHERE lobby_id = $1
    `,
    values: [lobbyId],
  };

  const getLobbyPlayersResult = await (client ?? db).query(getLobbyPlayersQuery);

  return getLobbyPlayersResult.rows;
};

const updateAllStatus = async (lobbyId, status, client = null) => {
  const updateAllStatusQuery = {
    text: `
    UPDATE lobby_player
    SET status = $1
    WHERE lobby_id = $2
    `,
    values: [status, lobbyId],
  };

  await (client ?? db).query(updateAllStatusQuery);
  return true;
};

const removeOtherPlayers = async (lobbyId, playerId, client = null) => {
  // Deletes all lobby_players from lobbyId except playerId
  const removeOtherPlayersQuery = {
    text: `
    DELETE FROM lobby_player
    WHERE lobby_id = $1
    AND player_id <> $2
    `,
    values: [lobbyId, playerId],
  };

  await (client ?? db).query(removeOtherPlayersQuery);
};

const existsLobbyPlayer = async (playerId, client = null) => {
  const getQuery = {
    text: `SELECT 1 FROM lobby_player
    WHERE player_id = $1`,
    values: [playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows.length > 0;
};

const setNewSet = async (lobbyId, playerId, newSetVote, client = null) => {
  const updateQuery = {
    text: `UPDATE lobby_player
    SET new_set = $1
    WHERE lobby_id = $2
    AND player_id = $3`,
    values: [newSetVote, lobbyId, playerId],
  };

  await (client ?? db).query(updateQuery);
};

const setCancelSet = async (lobbyId, playerId, cancelSetVote, client = null) => {
  const updateQuery = {
    text: `UPDATE lobby_player
    SET cancel_set = $1
    WHERE lobby_id = $2
    AND player_id = $3`,
    values: [cancelSetVote, lobbyId, playerId],
  };

  await (client ?? db).query(updateQuery);
};

const isNewSetDecided = async (lobbyId, client = null) => {
  const getQuery = {
    text: `SELECT 1 FROM lobby_player
    WHERE lobby_id = $1
    AND new_set
    AND NOT EXISTS (
      SELECT 1 FROM lobby_player
      WHERE lobby_id = $1
      AND NOT new_set
    )`,
    values: [lobbyId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows.length != 0;
};

const isCancelSetDecided = async (lobbyId, client = null) => {
  const getQuery = {
    text: `SELECT 1 FROM lobby_player
    WHERE lobby_id = $1
    AND cancel_set
    AND NOT EXISTS (
      SELECT 1 FROM lobby_player
      WHERE lobby_id = $1
      AND NOT cancel_set
    )`,
    values: [lobbyId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows.length != 0;
};

const getOpponent = async (lobbyId, playerId, client = null) => {
  const getQuery = {
    text: `SELECT player.*, lobby_player.*
    FROM lobby_player
    INNER JOIN player
      ON player.id = lobby_player.player_id
    WHERE lobby_player.lobby_id = $1
    AND lobby_player.player_id <> $2`,
    values: [lobbyId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

module.exports = {
  get,
  updateStatus,
  updateAllStatus,
  insert,
  getMessage,
  setMessage,
  getLobbyPlayers,
  removeOtherPlayers,
  existsLobbyPlayer,
  setNewSet,
  setCancelSet,
  isCancelSetDecided,
  isNewSetDecided,
  getOpponent,
};
