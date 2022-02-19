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
    UPDATE lobby_tier
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
    WHERE lobby.created_by = $1
    AND lobby_tier.message_id IS NOT NULL`,
    values: [playerId],
  };

  const getMessagesResult = await (client ?? db).query(getMessagesQuery);
  return getMessagesResult.rows;
};

const clearMessages = async (lobbyId, client = null) => {
  // Remove #tier messages from every lobbyTier of this lobby

  const updateQuery = {
    text: `UPDATE lobby_tier
    SET message_id = NULL
    WHERE lobby_id = $1`,
    values: [lobbyId],
  };

  await (client ?? db).query(updateQuery);
};

const getAllMessages = async (lobbyId, client = null) => {
  // Get information about the messages sent to #tier channels
  // by all lobby_players in the lobbyId
  //  {guild_id, player_id, lobby_id, discord_id (tier), channel_id (tier), message_id}
  const getAllMessagesQuery = {
    text: `
    SELECT guild.discord_id as guild_id, 
      player.discord_id as player_id, lobby_tier.*,
      tier.discord_id, tier.channel_id
    FROM lobby_tier INNER JOIN tier
      ON lobby_tier.tier_id = tier.id
    INNER JOIN lobby
      ON lobby.id = lobby_tier.lobby_id
    INNER JOIN player
      ON lobby.created_by = player.id
    INNER JOIN guild
      ON lobby.guild_id = guild.id
    WHERE lobby_tier.message_id IS NOT NULL
    AND lobby.created_by IN (
      SELECT player_id FROM lobby_player
      WHERE lobby_player.lobby_id = $1
    )
    `,
    values: [lobbyId],
  };

  const getAllMessagesResult = await (client ?? db).query(getAllMessagesQuery);

  return getAllMessagesResult.rows;
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
      SELECT 1 FROM lobby_tier
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

const getChannels = async (lobbyId, client = null) => {
  // Returns all the channels this lobby is searching at

  const getChannelsQuery = {
    text: `
    SELECT discord_id AS tier_id, channel_id FROM lobby_tier
    INNER JOIN tier
      ON lobby_tier.tier_id = tier.id
    WHERE lobby_id = $1`,
    values: [lobbyId],
  };

  const channelsInfo = await (client ?? db).query(getChannelsQuery);
  return channelsInfo.rows;
};
module.exports = {
  get,
  updateMessage,
  getMessages,
  clearMessages,
  getAllMessages,
  getChannels,
  remove,
  hasAnyTier,
};
