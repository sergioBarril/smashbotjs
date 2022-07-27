const db = require("./db");
const { Tier } = require("./tier");

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

  getTier = async (client = null) => {
    if (this.tierId == null) return null;
    const tier = await db.getBy("tier", { id: this.tierId }, client);
    if (tier == null) return null;
    else return new Tier(tier);
  };
}

const getMessage = async (messageId, discord, client = null) => {
  const message = await db.basicGet("message", messageId, discord, client);
  if (message == null) return null;
  else return new Message(message);
};

const insertMessage = async ({
  discordId,
  tierId = null,
  channelId = null,
  playerId = null,
  ranked = null,
  guildId = null,
  lobbyId = null,
}) => {
  const insertQuery = {
    text: `
    INSERT INTO message(discord_id, tier_id, channel_id, player_id, ranked, guild_id, lobby_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    values: [discordId, tierId, channelId, playerId, ranked, guildId, lobbyId],
  };
  await db.insertQuery(insertQuery);

  return await getMessage(discordId, true);
};

module.exports = {
  Message,
  getMessage,
  insertMessage,
};
