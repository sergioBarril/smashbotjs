const db = require("./db");

class Message {
  constructor({
    id,
    discord_id,
    type,
    tier_id,
    channel_id,
    player_id,
    ranked,
    guild_id,
    lobby_id,
  }) {
    this.id = id;
    this.discordId = discord_id;

    this.type = type;
    this.tierId = tier_id;
    this.lobbyId = lobby_id;

    this.channelId = channel_id;
    this.guildId = guild_id;

    this.playerId = player_id;
    this.ranked = ranked;
  }

  getTier = async (client = null) => {
    const { Tier } = require("./tier");

    if (this.tierId == null) return null;
    const tier = await db.getBy("tier", { id: this.tierId }, client);
    if (tier == null) return null;
    else return new Tier(tier);
  };

  remove = async (client = null) => await db.basicRemove("message", this.id, false, client);
}

const getMessage = async (messageId, discord, client = null) => {
  const message = await db.basicGet("message", messageId, discord, client);
  if (message == null) return null;
  else return new Message(message);
};

const insertMessage = async (
  discordId,
  type,
  tierId = null,
  channelId = null,
  playerId = null,
  guildId = null,
  lobbyId = null,
  ranked = null,
  client = null
) => {
  const insertQuery = {
    text: `
    INSERT INTO message(discord_id, type, tier_id, channel_id, player_id, ranked, guild_id, lobby_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    values: [discordId, type, tierId, channelId, playerId, ranked, guildId, lobbyId],
  };
  await db.insertQuery(insertQuery, client);

  return await getMessage(discordId, true, client);
};

const MESSAGE_TYPES = {
  LOBBY_TIER: "LOBBY_TIER",
  LOBBY_PLAYER: "LOBBY_PLAYER",
  GUILD_TIER_SEARCH: "GUILD_TIER_SEARCH",
  GAME_CHARACTER_SELECT: "GAME_CHARACTER_SELECT",
};

module.exports = {
  Message,
  MESSAGE_TYPES,
  getMessage,
  insertMessage,
};
