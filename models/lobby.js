const db = require("./db");
const { getPlayer } = require("./player");
const { getGuild } = require("./guild");
const { LobbyTier } = require("./lobbyTier");
const { Message } = require("./message");
const { LobbyPlayer } = require("./lobbyPlayer");
const { Gameset } = require("./gameset");

class Lobby {
  constructor({
    id,
    status,
    guild_id,
    mode,
    text_channel_id,
    voice_channel_id,
    created_by,
    created_at,
    ranked,
  }) {
    this.id = id;
    this.status = status;

    this.guildId = guild_id;
    this.mode = mode; // "FRIENDLIES" or "RANKED", in the future maybe "TEAMS" or "TOURNAMENT"

    this.textChannelId = text_channel_id;
    this.voiceChannelId = voice_channel_id;

    this.createdBy = created_by;
    this.createdAt = created_at;

    this.ranked = ranked; // ranked boolean
  }
  hasTier = async (tierId, client = null) => {
    if (!tierId) return false;

    const tiersQuery = {
      text: `
      SELECT 1 FROM lobby_tier
      WHERE lobby_id = $1
      AND tier_id = $2
      `,
      values: [this.id, tierId],
    };

    const tier = await db.getQuery(tiersQuery, client);
    return tier != null;
  };

  addTiers = async (tiers, client = null) => {
    for (tier of tiers) {
      const addTierQuery = {
        text: `INSERT INTO lobby_tier(lobby_id, tier_id) VALUES ($1, $2)`,
        values: [lobbyId, tier.id],
      };
      await db.insertQuery(addTierQuery, client);
    }
    return true;
  };

  addPlayer = async (playerId, status, client = null) => {
    const insertQueryString = {
      text: `
      INSERT INTO lobby_player(lobby_id, player_id, status)
      VALUES ($1, $2, $3)
      `,
      values: [this.id, playerId, status],
    };

    await db.insertQuery(insertQueryString, client);
  };

  remove = async (client = null) => await db.basicRemove("lobby", this.id, false, client);

  removeOtherLobbies = async (client = null) => {
    // Deletes all lobbies where the owner is, except this one
    const removeOtherQuery = {
      text: `DELETE FROM lobby
      WHERE lobby.id IN (
        SELECT lob.id FROM lobby lob
        INNER JOIN lobby_player lp
        ON lp.player_id = lob.created_by
        WHERE lp.lobby_id = $1
        AND lob.id <> $1
        )`,
      values: [this.id],
    };

    return await db.deleteQuery(removeOtherQuery, client);
  };

  allAccepted = async (client = null) => {
    const checkAcceptedQuery = {
      text: `
    SELECT NOT EXISTS(
      SELECT 1 FROM lobby_player
      WHERE lobby_id = $1
      AND status <> 'ACCEPTED'
      )
      `,
      values: [this.id],
    };

    const checkAcceptedResult = await db.getQuery(checkAcceptedQuery, client);
    return checkAcceptedResult;
  };

  removeMessages = async (client = null) => {
    // Remove #tier messages from every lobbyTier of this lobby
    const queryString = {
      text: `DELETE FROM message WHERE lobby_id = $1`,
      values: [this.id],
    };

    await db.deleteQuery(queryString, client);
  };

  // *************
  //    GETTERS
  // *************
  getGuild = async (client = null) => {
    const guild = await getGuild(this.guildId, false, client);
    return guild;
  };

  getGameset = async (client = null) => {
    const gameset = await db.getBy("gameset", { lobby_id: this.id }, client);
    if (gameset == null) return null;
    else return new Gameset(gameset);
  };

  getLobbyPlayer = async (playerId, client = null) => {
    const whereCondition = { lobby_id: this.id, player_id: playerId };
    const lp = await db.getBy("lobby_player", whereCondition, client);

    if (lp == null) return null;
    else return new LobbyPlayer(lp);
  };

  getLobbyPlayers = async (client = null) => {
    const whereCondition = { lobby_id: this.id };
    const lps = await db.filterBy("lobby_player", whereCondition, client);

    return lps.map((row) => new LobbyPlayer(row));
  };

  setLobbyPlayersStatus = async (status, client = null) => {
    const whereCondition = { lobby_id: this.id };
    await db.updateBy("lobby_player", { status }, whereCondition, client);
  };

  removeOtherPlayers = async (playerId, client = null) => {
    // Deletes all lobby_players from lobbyId except playerId
    const removeOtherPlayersQuery = {
      text: `
    DELETE FROM lobby_player
    WHERE lobby_id = $1
    AND player_id <> $2
    `,
      values: [this.id, playerId],
    };

    await db.deleteQuery(removeOtherPlayersQuery, client);
  };

  isNewSetDecided = async (client = null) => {
    const getQuery = {
      text: `SELECT 1 FROM lobby_player
    WHERE lobby_id = $1
    AND new_set
    AND NOT EXISTS (
      SELECT 1 FROM lobby_player
      WHERE lobby_id = $1
      AND NOT new_set
    )`,
      values: [this.id],
    };

    const getResult = await db.getQuery(getQuery, client, false);
    return getResult != null;
  };

  isCancelSetDecided = async (client = null) => {
    const getQuery = {
      text: `SELECT 1 FROM lobby_player
    WHERE lobby_id = $1
    AND cancel_set
    AND NOT EXISTS (
      SELECT 1 FROM lobby_player
      WHERE lobby_id = $1
      AND NOT cancel_set
    )`,
      values: [this.id],
    };

    const getResult = await db.getQuery(getQuery, client, false);
    return getResult != null;
  };

  getLobbyTier = async (tierId, client = null) => {
    const whereCondition = { lobby_id: this.id, tier_id: tierId };
    const lt = await db.getBy("lobby_tier", whereCondition, client);

    if (lt == null) return null;
    else return new LobbyTier(lt);
  };

  getLobbyTiers = async (client = null) => {
    const whereCondition = { lobby_id: this.id };
    const lts = await db.filterBy("lobby_tier", whereCondition, client);

    return lts.map((row) => new LobbyTier(row));
  };

  hasAnyTier = async (client = null) => {
    const lts = await this.getLobbyTiers(client);
    return lts.length > 0;
  };

  getOwnMessages = async (client = null) => {
    const getMessagesResult = await db.filterBy("message", { lobby_id: this.id }, client);
    return getMessagesResult.map((row) => new Message(row));
  };

  // ***********
  //    SETTERS
  // ************

  setLobbyChannels = async (textChannelId, voiceChannelId, client = null) => {
    const setValues = { text_channel_id: textChannelId, voice_channel_id: voiceChannelId };
    await db.updateBy("lobby", setValues, { id: this.id }, client);

    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;
  };

  setStatus = async (status, client = null) => {
    await db.updateBy("lobby", { status }, { id: this.id }, client);
    this.status = status;
  };

  setRanked = async (ranked, client = null) => {
    await db.updateBy("lobby", { ranked }, { id: this.id }, client);
    this.ranked = ranked;
  };
}

const getLobby = async (lobbyId, client = null) => {
  return await db.basicGet("lobby", lobbyId, discord, client);
};

const getBy = async (dbFieldName, value, client = null) => {
  const lobby = await db.getBy("lobby", { [dbFieldName]: value }, client);
  if (lobby == null) return null;
  else return new Lobby(lobby);
};

const getByTextChannel = async (rankedRoleId, client = null) =>
  await getBy("text_channel_id", rankedRoleId, client);

const insertLobby = async ({
  guildId,
  playerId,
  targetTiers = null,
  mode = "FRIENDLIES",
  status = "SEARCHING",
  ranked = false,
}) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const insertLobby = {
      text: `
        INSERT INTO lobby(status, guild_id, mode, created_by, ranked)
        VALUES ($1, $2, $3, $4, $5)
      `,
      values: [status, guildId, mode, playerId, ranked],
    };
    await db.insertQuery(insertLobby, client);

    const player = await getPlayer({ playerId, discord: false, client });
    const lobby = await player.getOwnLobby(client);
    await lobby.addPlayer(player.id, status, client);

    if (targetTiers == null) targetTiers = [];
    await lobby.addTiers(targetTiers, client);

    await client.query("COMMIT");
    return lobby;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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

module.exports = {
  getLobby,
  getByTextChannel,
  insertLobby,
  // matchmaking, --> A revisar
  Lobby,
};
