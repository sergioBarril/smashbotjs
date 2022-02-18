const db = require("./index");

const get = async (guildId, discord = false, client = null) =>
  await db.basicGet("guild", guildId, discord, client);

const getByLobby = async (lobbyId, client = null) => {
  const getGuildQuery = {
    text: `
    SELECT guild.* FROM guild
    INNER JOIN lobby
    ON lobby.guild_id = guild.id
    WHERE lobby.id = $1
    `,
    values: [lobbyId],
  };

  const getGuildResult = await (client ?? db).query(getGuildQuery);
  if (getGuildResult.rows?.length > 0) return getGuildResult.rows[0];
  else return null;
};

const setMatchmakingChannel = async (guildId, channelId, client = null) => {
  const updateQuery = {
    text: `UPDATE guild
    SET search_channel_id = $1
    WHERE id = $2`,
    values: [channelId, guildId],
  };

  await (client ?? db).query(updateQuery);
};

const getCurrentList = async (guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT tier.discord_id AS tier_id, player.discord_id AS player_id, 
      tier.search_message_id AS message_id
    FROM tier
    INNER JOIN lobby_tier lt
      ON tier.id = lt.tier_id
    INNER JOIN lobby l
      ON l.id = lt.lobby_id
    INNER JOIN lobby_player lp
      ON lp.player_id = l.created_by
    INNER JOIN player
      ON player.id = lp.player_id
    WHERE tier.guild_id = $1
    `,
    values: [guildId],
  };

  const getResult = await (client ?? db).query(getQuery);

  return getResult.rows;
};

module.exports = {
  get,
  getByLobby,
  getCurrentList,
  setMatchmakingChannel,
};
