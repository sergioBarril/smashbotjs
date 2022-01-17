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

const matchmaking = async (playerId, lobbyId, tierId) => {
  // Check if can be matched
  const matchmakingQuery = {
    text: `
    SELECT lobby.id AS lobby_id, lobby_player.player_id AS player_id
    FROM lobby INNER JOIN lobby_player
      ON lobby_player.lobby_id = lobby.id
    INNER JOIN lobby_tier
      ON lobby_tier.lobby_id = lobby.id    
    WHERE lobby.id <> $1
    AND lobby_tier.tier_id = $2
    AND lobby_player.status = 'SEARCHING'`,
    values: [lobbyId, tierId],
  };

  const matchmakingRes = await db.query(matchmakingQuery);
  const matchingPlayers = matchmakingRes.rows;

  if (matchingPlayers.length == 0) return false;

  // If matched, update statuses and return info
  const { player_id: rivalPlayerId, lobby_id: rivalLobbyId } =
    matchingPlayers[0];

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const lobbyConfirmationStatusQuery = {
      text: `
      UPDATE lobby SET status = 'CONFIRMATION'
      WHERE id = $1`,
      values: [lobbyId],
    };

    const lobbyWaitingStatusQuery = {
      text: `
      UPDATE lobby SET status = 'WAITING'
      WHERE id = $1`,
      values: [rivalLobbyId],
    };

    const lobbyPlayerUpdateQuery = {
      text: `
      UPDATE lobby_player SET status = 'CONFIRMATION'
      WHERE player_id = $1`,
      values: [playerId],
    };

    const lobbyPlayerInsertQuery = {
      text: `
      INSERT INTO lobby_player(lobby_id, player_id, status)
      VALUES ($1, $2, 'CONFIRMATION');
      `,
      values: [lobbyId, rivalPlayerId],
    };

    const rivalLobbyPlayerUpdateQuery = {
      text: `
      UPDATE lobby_player SET status = 'WAITING'
      WHERE lobby_id = $1 AND player_id = $2
      `,
      values: [rivalLobbyId, rivalPlayerId],
    };

    await client.query(lobbyConfirmationStatusQuery);
    await client.query(lobbyWaitingStatusQuery);
    await client.query(lobbyPlayerUpdateQuery);
    await client.query(lobbyPlayerInsertQuery);
    await client.query(rivalLobbyPlayerUpdateQuery);
    await client.query("COMMIT");

    const player = await playerDB.get(playerId, false, client);
    const rivalPlayer = await playerDB.get(rivalPlayerId, false, client);

    return {
      playerDiscordId: player.discord_id,
      rivalPlayerDiscordId: rivalPlayer.discord_id,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
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

const setConfirmationDM = async (
  playerId,
  messageId,
  discord = false,
  client = null
) => {
  if (discord) {
    const player = await playerDB.get(playerId, discord, client);
    playerId = player.id;
  }

  const updateMessageQuery = {
    text: `
    UPDATE lobby_player SET message_id = $1
    WHERE player_id = $2`,
    values: [messageId, playerId],
  };

  await (client ?? db).query(updateMessageQuery);
  return true;
};

const getConfirmationDM = async (playerId, discord = false, client = null) => {
  if (discord) {
    const player = await playerDB.get(playerId, discord, client);
    playerId = player.id;
  }
  const getMessageQuery = {
    text: `
    SELECT player.discord_id, message_id FROM lobby_player
    INNER JOIN player
    ON player.id = lobby_player.player_id
    WHERE message_id IS NOT NULL
    AND lobby_id IN (
      SELECT lp.lobby_id FROM lobby_player lp
      WHERE lp.player_id = $1
      AND lp.status IN ('ACCEPTED', 'CONFIRMATION')
    )`,
    values: [playerId],
  };

  const getMessageResult = await (client ?? db).query(getMessageQuery);
  if (getMessageResult.rows?.length > 0) return getMessageResult.rows;
  else return null;
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
