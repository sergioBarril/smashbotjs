const db = require("./db");

class Message {
  constructor({ id, discord_id, tier_id, channel_id, player_id, ranked, guild_id, lobby_id }) {
    this.id = id;
    this.discordId = discord_id;

    this.tierId = tier_id;
    this.lobbyId = lobby_id;

    this.channelId = channel_id;
    this.guildId = guild_id;

    this.playerId = player_id;
    this.ranked = ranked;
  }
}

const getMessage = async (messageId, client = null) => {
  const message = await db.getBy("message", { id: messageId }, client);
  if (message == null) return null;
  else return new Message(message);
};

module.exports = {
  Message,
  getMessage,
};
