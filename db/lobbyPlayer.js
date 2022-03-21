const db = require("./index");

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
    SELECT player_id, status, discord_id, message_id, lobby_id
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

module.exports = {
  updateStatus,
  updateAllStatus,
  insert,
  getMessage,
  setMessage,
  getLobbyPlayers,
  removeOtherPlayers,
  existsLobbyPlayer,
};
