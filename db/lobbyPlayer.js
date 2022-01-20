const db = require("./index");
const playerDB = require("./player");

const updateStatus = async (lobbyId, playerId, status, client = null) => {
  const updateStatusQuery = {
    text: `
    UPDATE FROM lobby_player
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
  if (getMessageResult.rows?.length > 0)
    return getMessageResult.rows[0].message_id;
  else return null;
};

module.exports = {
  updateStatus,
  insert,
  getMessage,
  setMessage,
};
