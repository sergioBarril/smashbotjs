const db = require("./db");
const { getTier } = require("./tier");
const { insertMessage, MESSAGE_TYPES, Message } = require("./message");

class LobbyTier {
  constructor({ lobby_id, tier_id, created_at, message_id }) {
    this.lobbyId = lobby_id;
    this.tierId = tier_id;

    this.createdAt = created_at;
    this.messageId = message_id;
  }

  getTier = async (client = null) => {
    return await getTier(this.tierId, client);
  };

  getLobby = async (client = null) => {
    const { getLobby } = require("./lobby");
    return await getLobby(this.lobbyId, client);
  };

  getMessage = async (client = null) => {
    const getResult = await db.getBy(
      "message",
      { lobby_id: this.lobbyId, tier_id: this.tierId },
      client
    );
    if (!getResult) return null;
    else return new Message(getResult);
  };

  insertMessage = async (discordId, client = null) => {
    const tier = await this.getTier(client);
    const lobby = await this.getLobby(client);

    return await insertMessage(
      discordId,
      MESSAGE_TYPES.LOBBY_TIER,
      tier.id,
      tier.channelId,
      lobby.createdBy,
      lobby.guildId,
      lobby.id,
      false,
      client
    );
  };

  remove = async (client = null) => {
    const deleteLobbyTierQuery = {
      text: `
    DELETE FROM lobby_tier
    WHERE lobby_id = $1
    AND tier_id = $2
    `,
      values: [this.lobbyId, this.tierId],
    };

    await db.deleteQuery(deleteLobbyTierQuery, client);
    return true;
  };
}

// NECESITA LOBBY PLAYER
// const getAllMessages = async (lobbyId, client = null) => {
//   // Get information about the messages sent to #tier channels
//   // by all lobby_players in the lobbyId
//   //  {guild_id, player_id, lobby_id, discord_id (tier), channel_id (tier), message_id}
//   const getAllMessagesQuery = {
//     text: `
//     SELECT guild.discord_id as guild_id,
//       player.discord_id as player_id, lobby_tier.*,
//       tier.discord_id, tier.channel_id
//     FROM lobby_tier INNER JOIN tier
//       ON lobby_tier.tier_id = tier.id
//     INNER JOIN lobby
//       ON lobby.id = lobby_tier.lobby_id
//     INNER JOIN player
//       ON lobby.created_by = player.id
//     INNER JOIN guild
//       ON lobby.guild_id = guild.id
//     WHERE lobby_tier.message_id IS NOT NULL
//     AND lobby.created_by IN (
//       SELECT player_id FROM lobby_player
//       WHERE lobby_player.lobby_id = $1
//     )
//     `,
//     values: [lobbyId],
//   };

//   const getAllMessagesResult = await (client ?? db).query(getAllMessagesQuery);

//   return getAllMessagesResult.rows;
// };

//  A ver su verdadera utilidad

// const getChannels = async (lobbyId, client = null) => {
//   // Returns all the channels this lobby is searching at

//   const getChannelsQuery = {
//     text: `
//     SELECT discord_id AS tier_id, channel_id, yuzu FROM lobby_tier
//     INNER JOIN tier
//       ON lobby_tier.tier_id = tier.id
//     WHERE lobby_id = $1`,
//     values: [lobbyId],
//   };

//   const channelsInfo = await (client ?? db).query(getChannelsQuery);
//   return channelsInfo.rows;
// };
module.exports = {
  LobbyTier,
  // getChannels, A VER SU UTILIDAD
};
