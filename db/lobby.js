const db = require("./index");
const playerDB = require("./player");

const get = async (lobbyId, discord = false, client = null) => {
  return await db.basicGet("lobby", lobbyId, discord);
};

const getByPlayer = async (playerId, discord = false, client = null) => {
  if (!playerId) return null;
  const tableQuery = "SELECT * FROM lobby WHERE created_by = $1";
  const discordQuery = `SELECT lobby.* FROM lobby
  INNER JOIN player
      ON lobby.created_by = player.id
    WHERE player.discord_id = $1`;

  const getQuery = {
    text: discord ? discordQuery : tableQuery,
    values: [playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows ? getResult.rows[0] : null;
};

const getByPlayerStatus = async (playerId, status, discord = false, client = null) => {
  // Get lobby info where the player is, and with a certain status

  if (!playerId || !status) return null;

  if (discord) {
    const player = await playerDB.get(playerId, true, client);
    playerId = player.id;
  }

  const getLobbyQuery = {
    text: `
    SELECT lobby.* FROM lobby
    INNER JOIN lobby_player
      ON lobby_player.lobby_id = lobby.id
    WHERE lobby.status = $1
    AND lobby_player.player_id = $2
    `,
    values: [status, playerId],
  };

  const getLobbyResult = await (client ?? db).query(getLobbyQuery);
  if (getLobbyResult.rows.length > 0) return getLobbyResult.rows[0];
  else return null;
};

const getByTextChannel = async (channelId, client = null) => {
  const getQuery = {
    text: `
    SELECT * FROM lobby
    WHERE text_channel_id = $1
    `,
    values: [channelId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getByGameSet = async (gamesetId, client = null) => {
  const getQuery = {
    text: `
    SELECT lobby.*
    FROM lobby 
    INNER JOIN gameset
      ON gameset.lobby_id = lobby.id
    WHERE gameset.id = $1
    `,
    values: [gamesetId],
  };

  const getResult = await (client ?? db).query(getQuery);

  return getResult.rows[0];
};

const getByTierChannelMessage = async (messageId, client = null) => {
  const getByMessageQuery = {
    text: `
    SELECT lobby.*
    FROM lobby INNER JOIN lobby_tier
    ON lobby_tier.lobby_id = lobby.id
    WHERE lobby_tier.message_id = $1
    `,
    values: [messageId],
  };

  const lobby = await (client ?? db).query(getByMessageQuery);

  if (lobby.rows.length === 1) return lobby.rows[0];
  else return null;
};

const hasTier = async (lobbyId, tierId, client = null) => {
  if (!lobbyId || !tierId) return false;

  const tiersQuery = {
    text: `
      SELECT 1 FROM lobby_tier
      WHERE lobby_id = $1
      AND tier_id = $2
    `,
    values: [lobbyId, tierId],
  };

  const isTier = await (client ?? db).query(tiersQuery);
  return isTier.rows?.length > 0;
};

const addTiers = async (lobbyId, tiers, client = null) => {
  for (tier of tiers) {
    const addTierQuery = {
      text: `INSERT INTO lobby_tier(lobby_id, tier_id) VALUES ($1, $2)`,
      values: [lobbyId, tier.id],
    };

    await (client ?? db).query(addTierQuery);
  }
  return true;
};

const create = async (
  guildId,
  playerId,
  targetTiers = null,
  mode = "FRIENDLIES",
  status = "SEARCHING"
) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    // INSERTS INTO LOBBY, LOBBY_PLAYER AND LOBBY_TIER
    const insertLobby = {
      text: `
        INSERT INTO lobby(status, guild_id, mode, created_by)
        VALUES ($1, $2, $3, $4)
      `,
      values: [status, guildId, mode, playerId],
    };

    await client.query(insertLobby);

    const lobby = await getByPlayer(playerId, false, client);

    const insertLobbyPlayer = {
      text: `
        INSERT INTO lobby_player(lobby_id, player_id, status)
        VALUES ($1, $2, $3)
      `,
      values: [lobby.id, playerId, status],
    };

    await client.query(insertLobbyPlayer);

    if (targetTiers === null) targetTiers = [];
    for (tier of targetTiers) {
      const insertLobbyTier = {
        text: `
        INSERT INTO lobby_tier(lobby_id, tier_id)
        VALUES ($1, $2)
      `,
        values: [lobby.id, tier.id],
      };
      await client.query(insertLobbyTier);
    }
    await client.query("COMMIT");
    return lobby;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const remove = async (lobbyId, discord = false, client = null) =>
  await db.basicRemove("lobby", lobbyId, discord, client);

const removeByPlayer = async (playerId, discord = false, client = null) => {
  if (!playerId) return false;
  const discordQuery = `DELETE FROM lobby WHERE lobby.created_by = (
      SELECT player.id FROM player
      WHERE player.discord_id = $1
    )`;
  const tableQuery = "DELETE FROM lobby WHERE lobby.created_by = $1";

  const removeQuery = {
    text: discord ? discordQuery : tableQuery,
    values: [playerId],
  };
  await (client ?? db).query(removeQuery);
  return true;
};

const removeOtherLobbies = async (lobbyId, client = null) => {
  const removeOtherQuery = {
    text: `DELETE FROM lobby
    WHERE lobby.id IN (
      SELECT lob.id FROM lobby lob
      INNER JOIN lobby_player lp
      ON lp.player_id = lob.created_by
      WHERE lp.lobby_id = $1
      AND lob.id <> $1
    )`,
    values: [lobbyId],
  };

  await (client ?? db).query(removeOtherQuery);
  return true;
};

const matchmaking = async (lobbyId, guildId, tierId = null, client = null) => {
  // Get someone to match to. If tierId is null, check all tiers

  // Check YuzuPlayer
  const ypResult = await (client ?? db).query({
    text: `SELECT yp.* FROM yuzu_player yp
      INNER JOIN lobby l
        ON l.created_by = yp.player_id
      WHERE l.id = $1 AND yp.guild_id = $2`,
    values: [lobbyId, guildId],
  });
  const yp = ypResult.rows[0];
  const values = [guildId, lobbyId, !!yp?.yuzu, !!yp?.parsec];

  // Tier Conditions
  let tierCondition = "";

  if (tierId) {
    tierCondition = "AND tier.id = $5";
    values.push(tierId);
  } else
    tierCondition = `
      AND tier.id IN (
      SELECT id FROM tier t
      INNER JOIN lobby_tier lt
        ON t.id = lt.tier_id
      WHERE lt.lobby_id = $2
      )`;

  const matchmakingQuery = {
    text: `
    SELECT lobby_player.lobby_id AS lobby_id, lobby_player.player_id AS player_id
    FROM lobby_player
    INNER JOIN lobby
      ON lobby.id = lobby_player.lobby_id
    INNER JOIN lobby_tier
      ON lobby_tier.lobby_id = lobby_player.lobby_id
    INNER JOIN tier
      ON lobby_tier.tier_id = tier.id
    LEFT JOIN yuzu_player
      ON yuzu_player.player_id = lobby_player.player_id
        AND yuzu_player.guild_id = $1
        AND tier.yuzu
    WHERE lobby.guild_id = $1
    AND lobby_player.lobby_id <> $2
    AND lobby_player.status = 'SEARCHING'
    AND (NOT tier.yuzu OR yuzu_player.parsec = $3 OR yuzu_player.yuzu = $4)
    ${tierCondition}
    ORDER BY tier.weight ASC, lobby_tier.created_at ASC
    `,
    values,
  };

  const matchmakingResult = await (client ?? db).query(matchmakingQuery);
  if (matchmakingResult.rows?.length > 0) return matchmakingResult.rows[0];
  else return null;
};

const allAccepted = async (lobbyId, client = null) => {
  const lobby = await get(lobbyId, false, client);

  const checkAcceptedQuery = {
    text: `
    SELECT NOT EXISTS(
      SELECT 1 FROM lobby_player
      WHERE lobby_id = $1
      AND status <> 'ACCEPTED'
    )
    `,
    values: [lobbyId],
  };

  const checkAcceptedResult = await (client ?? db).query(checkAcceptedQuery);

  return checkAcceptedResult.rows[0];
};

const updateLobbyChannels = async (lobbyId, textChannelId, voiceChannelId, client = null) => {
  const updateChannelsQuery = {
    text: `UPDATE lobby SET
    text_channel_id = $1,
    voice_channel_id = $2
    WHERE id = $3`,
    values: [textChannelId, voiceChannelId, lobbyId],
  };

  await (client ?? db).query(updateChannelsQuery);
};

const updateStatus = async (lobbyId, status, client = null) => {
  const updateStatusQuery = {
    text: `
    UPDATE lobby SET status = $1
    WHERE id = $2`,
    values: [status, lobbyId],
  };

  await (client ?? db).query(updateStatusQuery);
  return true;
};

const setRanked = async (lobbyId, isRanked, client = null) => {
  const updateQuery = {
    text: `
    UPDATE lobby SET ranked = $1
    WHERE id = $2`,
    values: [isRanked, lobbyId],
  };
};

module.exports = {
  get,
  getByPlayer,
  getByGameSet,
  getByPlayerStatus,
  getByTextChannel,
  getByTierChannelMessage,
  create,
  remove,
  removeByPlayer,
  removeOtherLobbies,
  hasTier,
  addTiers,
  matchmaking,
  updateLobbyChannels,
  updateStatus,
  allAccepted,
  setRanked,
};
