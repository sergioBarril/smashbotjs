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

const insert = async (lobbyId, messageId, channelId, ranked, client = null) => {
  const insertMessagesQuery = {
    text: `
    INSERT INTO lobby_message(lobby_id, message_id, channel_id, ranked)
    VALUES ($1, $2, $3, $4)
    `,
    values: [lobbyId, messageId, channelId, ranked],
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
