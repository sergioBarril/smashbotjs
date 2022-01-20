const db = require("./index");

const get = async (lobbyId, tierId, client = null) => {
  const getQuery = {
    text: `
    SELECT * FROM lobby_tier
    WHERE lobby_id = $1
    AND tier_id = $2`,
    values: [lobbyId, tierId],
  };

  const getResult = await (client ?? db).query(getQuery);
  if (getResult?.rows?.length > 0) return getResult.rows[0];
  return null;
};

const updateMessage = async (lobbyId, tierId, messageId, client = null) => {
  const updateMessageQuery = {
    text: `
    UPDATE FROM lobby_tier
    SET message_id = $1
    WHERE lobby_id = $2
    AND tier_id = $3
    `,
    values: [messageId, lobbyId, tierId],
  };

  await (client ?? db).query(updateMessageQuery);

  return true;
};

const getMessages = async (playerId, client = null) => {
  const getMessagesQuery = {
    text: `
    SELECT lobby_tier.*, tier.discord_id FROM lobby_tier
    INNER JOIN lobby
      ON lobby.id = lobby_tier.lobby_id
    INNER JOIN tier
      ON lobby_tier.tier_id = tier.id
    WHERE lobby.created_by = $1`,
    values: [playerId],
  };

  const getMessagesResult = await (client ?? db).query(getMessagesQuery);
  if (getMessagesResult.rows?.length > 0) return getMessagesResult.rows;
  else return null;
};

const remove = async (lobbyId, tierId, client = null) => {
  const deleteLobbyTierQuery = {
    text: `
    DELETE FROM lobby_tier
    WHERE lobby_id = $1
    AND tier_id = $2
    `,
    values: [lobbyId, tierId],
  };

  await (client ?? db).query(deleteLobbyTierQuery);
  return true;
};

const hasAnyTier = async (lobbyId, client = null) => {
  const hasAnyTierQuery = {
    text: `
    SELECT EXISTS (
      SELECT 1 FROM lobby_player
      WHERE lobby_id = $1
    ) AS "exists"
    `,
    values: [lobbyId],
  };

  const hasAnyTierResult = await (client ?? db).query(hasAnyTierQuery);
  if (hasAnyTierResult?.rows?.length > 0)
    return hasAnyTierResult.rows[0].exists;
  return false;
};
// const insert = async (lobbyId, playerId, status, client = null) => {
//   const insertLobbyPlayerQuery = {
//     text: `
//     INSERT INTO lobby_tier(lobby_id, player_id, status)
//     VALUES ($1, $2, $3)
//     `,
//     values: [lobbyId, playerId, status],
//   };

//   await (client ?? db).query(insertLobbyPlayerQuery);
//   return true;
// };

module.exports = {
  get,
  updateMessage,
  getMessages,
  remove,
  hasAnyTier,
};
