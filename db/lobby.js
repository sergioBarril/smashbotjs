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

const getConfirmationLobbyByPlayer = async (
  playerId,
  discord = false,
  client = null
) => {
  if (discord) {
    const player = await playerDB.get(playerId, discord, client);
    playerId = player.id;
  }

  const getAcceptedLobbyQuery = {
    text: `
    SELECT lobby.* FROM lobby
    INNER JOIN lobby_player
    ON lobby_player.lobby_id = lobby.id
    WHERE lobby.status = 'CONFIRMATION'
    AND lobby_player.player_id = $1`,
    values: [playerId],
  };

  const getAcceptedLobbyResult = await (client ?? db).query(
    getAcceptedLobbyQuery
  );

  if (getAcceptedLobbyResult.rows?.length === 1)
    return getAcceptedLobbyResult.rows[0];
  else return null;
};

const hasTier = async (lobbyId, tierId) => {
  if (!lobbyId || !tierId) return false;

  const tiersQuery = {
    text: `
      SELECT 1 FROM lobby_tier
      WHERE lobby_id = $1
      AND tier_id = $2
    `,
    values: [lobbyId, tierId],
  };

  const isTier = await db.query(tiersQuery);
  return isTier.rows?.length > 0;
};

const addTier = async (lobbyId, tierId) => {
  const addTierQuery = {
    text: `INSERT INTO lobby_tier(lobby_id, tier_id) VALUES ($1, $2)`,
    values: [lobbyId, tierId],
  };

  await db.query(addTierQuery);
  return true;
};

const create = async (
  guildId,
  playerId,
  tierId,
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

    const insertLobbyTier = {
      text: `
        INSERT INTO lobby_tier(lobby_id, tier_id)
        VALUES ($1, $2)
      `,
      values: [lobby.id, tierId],
    };

    await client.query(insertLobbyPlayer);
    await client.query(insertLobbyTier);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
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
  await db.query(removeQuery);
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

const removeTier = async (lobbyId, tierId, client = null) => {
  if (!lobbyId || !tierId) return false;
  client = client ?? (await db.getClient());

  try {
    await client.query("BEGIN");
    const removeTierQuery = {
      text: `DELETE FROM lobby_tier WHERE lobby_id = $1 AND tier_id = $2`,
      values: [lobbyId, tierId],
    };

    await client.query(removeTierQuery);

    const tiersSearchingQuery = {
      text: `SELECT * FROM lobby_tier WHERE lobby_id = $1`,
      values: [lobbyId],
    };

    const res = await client.query(tiersSearchingQuery);
    const hasTiersLeft = res.rows?.length > 0;

    if (!hasTiersLeft) await remove(lobbyId, false, client);

    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
};

const matchmaking = async (lobbyId, tierId = null, client = null) => {
  // Get someone to match to. If tierId is null, check all tiers

  const tierCondition = tierId
    ? `AND tier.id = $2`
    : `
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
    values: [lobbyId, tierId],
  };

  const matchmakingResult = await (client ?? db).query(matchmakingQuery);
  if (matchmakingResult.rows?.length > 0) return matchmakingResult.rows[0];
  else return null;
};

const acceptMatch = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await getByPlayer(player.id, false);

  const updateLobbyPlayer = {
    text: `
    UPDATE lobby_player SET status = 'ACCEPTED'
    WHERE lobby_id = $1 AND player_id = $2
    `,
    values: [lobby.id, player.id],
  };
  await db.query(updateLobbyPlayer);

  // Check if all accepted
  const allLobbyPlayersQuery = {
    text: `
    SELECT status, discord_id
    FROM lobby_player INNER JOIN player
    ON lobby_player.player_id = player.id
    WHERE lobby_id = $1
    `,
    values: [lobby.id],
  };

  const lobbyPlayers = await db.query(allLobbyPlayersQuery);

  if (lobbyPlayers.rows.length === 0) return null;
  return lobbyPlayers.rows
    .filter((x) => x.status !== "ACCEPTED")
    .map((x) => x.discord_id);
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

const rejectConfirmation = async (playerId, discord = false) => {
  if (discord) {
    const player = await playerDB.get(playerId, discord);
    playerId = player.id;
  }
  const lobby = await getConfirmationLobbyByPlayer(playerId, false, client);

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Get all players
    const getPlayersQuery = {
      text: `
      SELECT lobby_player.player_id AS player_id,
        player.discord_id AS discord_id,
        lobby_player.message_id AS message_id 
      FROM lobby_player INNER JOIN player
        ON player.id = lobby_player.player_id
      WHERE lobby_id = $1
      `,
      values: [lobby.id],
    };

    const getPlayersResult = await client.query(getPlayersQuery);

    const otherPlayers = getPlayersResult.rows.filter(
      (player) => player.player_id !== playerId
    );

    const otherPlayerIds = otherPlayers.map((player) => player.player_id);

    // Update their lobbies status
    for (otherPlayerId in otherPlayerIds) {
      const playerLobby = await getByPlayer(otherPlayerId, false, client);
      await updateStatus(playerLobby.id, "AFK", client);
    }

    // Remove Lobby Players
    if (lobby.created_by !== playerId) {
      const removeLobbyPlayers = {
        text: `
        DELETE FROM lobby_player
        WHERE lobby_id = $1 
        AND player_id <> $2`,
        values: [lobby.id, lobby.created_by],
      };

      await client.query(removeLobbyPlayers);
    }

    // Remove the lobby
    await removeByPlayer(playerId, false, client);
    await client.query("COMMIT");

    return {
      declined: getPlayersResult.rows.filter(
        (player) => player.id === playerId
      ),
      others: otherPlayers,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
};

module.exports = {
  get,
  getByPlayer,
  getConfirmationLobbyByPlayer,
  create,
  remove,
  removeByPlayer,
  removeOtherLobbies,
  hasTier,
  addTier,
  removeTier,
  matchmaking,
  acceptMatch,
  getConfirmationDM,
  setConfirmationDM,
  updateLobbyChannels,
  updateStatus,
  rejectConfirmation,
};
