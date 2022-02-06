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

const getByPlayerStatus = async (
  playerId,
  status,
  discord = false,
  client = null
) => {
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

const addTier = async (lobbyId, tierId, client = null) => {
  const addTierQuery = {
    text: `INSERT INTO lobby_tier(lobby_id, tier_id) VALUES ($1, $2)`,
    values: [lobbyId, tierId],
  };

  await (client ?? db).query(addTierQuery);
  return true;
};

const create = async (
  guildId,
  playerId,
  tierId = null,
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

    if (tierId) {
      const insertLobbyTier = {
        text: `
        INSERT INTO lobby_tier(lobby_id, tier_id)
        VALUES ($1, $2)
      `,
        values: [lobby.id, tierId],
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

const matchmaking = async (lobbyId, tierId = null, client = null) => {
  // Get someone to match to. If tierId is null, check all tiers

  let tierCondition = "";
  const values = [lobbyId];
  if (tierId) {
    tierCondition = "AND tier.id = $2";
    values.push(tierId);
  } else
    tierCondition = `
      AND tier.id IN (
      SELECT id FROM tier t
      INNER JOIN lobby_tier lt
        ON t.id = lt.tier_id
      WHERE lt.lobby_id = $1
      )`;

  const matchmakingQuery = {
    text: `
    SELECT lobby_player.lobby_id AS lobby_id, lobby_player.player_id AS player_id
    FROM lobby_player
    INNER JOIN lobby_tier
      ON lobby_tier.lobby_id = lobby_player.lobby_id
    INNER JOIN tier
      ON lobby_tier.tier_id = tier.id
    WHERE lobby_player.lobby_id <> $1
    AND lobby_player.status = 'SEARCHING'
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

const updateLobbyChannels = async (
  lobbyId,
  textChannelId,
  voiceChannelId,
  client = null
) => {
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

module.exports = {
  get,
  getByPlayer,
  getByPlayerStatus,
  getByTierChannelMessage,
  create,
  remove,
  removeByPlayer,
  removeOtherLobbies,
  hasTier,
  addTier,
  matchmaking,
  updateLobbyChannels,
  updateStatus,
  allAccepted,
};
