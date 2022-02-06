const db = require("./index");

const getMessages = async (lobbyId, client = null) => {
  const getMessagesQuery = {
    text: `
    SELECT * FROM lobby_message
    WHERE lobby_id = $1`,
    values: [lobbyId],
  };

  const getMessagesResult = await (client ?? db).query(getMessagesQuery);
  return getMessagesResult.rows;
};

const insert = async (lobbyId, messageId, channelId, client = null) => {
  const insertMessagesQuery = {
    text: `
    INSERT INTO lobby_message(lobby_id, message_id, channel_id)
    VALUES ($1, $2, $3)
    `,
    values: [lobbyId, messageId, channelId],
  };

  await (client ?? db).query(insertMessagesQuery);
};

const remove = async (lobbyId, client = null) => {
  const deleteLobbyTierQuery = {
    text: `
    DELETE FROM lobby_message
    WHERE lobby_id = $1
    `,
    values: [lobbyId],
  };

  await (client ?? db).query(deleteLobbyTierQuery);
  return true;
};

module.exports = {
  getMessages,
  insert,
  remove,
};
