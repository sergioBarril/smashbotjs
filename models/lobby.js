const db = require("./db");
const { getGuild } = require("./guild");
const { LobbyTier } = require("./lobbyTier");
const { Message, MESSAGE_TYPES } = require("./message");
const { LobbyPlayer } = require("./lobbyPlayer");
const { Gameset } = require("./gameset");
const { YuzuPlayer } = require("./yuzuPlayer");
const { Client } = require("pg");

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
    for (let tier of tiers) {
      const addTierQuery = {
        text: `INSERT INTO lobby_tier(lobby_id, tier_id) VALUES ($1, $2)`,
        values: [this.id, tier.id],
      };
      await db.insertQuery(addTierQuery, client);
    }
    return await this.getLobbyTiers(client);
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

    return await this.getLobbyPlayer(playerId, client);
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

  /**
   * Remove all the messages of this lobby.
   * Can choose the target type
   * @param {MESSAGE_TYPES} type Type of message that will be removed (all of them if null)
   * @param {Client} client Optional PG client
   */
  removeMessages = async (type = null, client = null) => {
    const values = [this.id];
    let typeCondition = "";
    if (type != null) {
      typeCondition = " AND type = $2";
      values.push(type);
    }

    const queryString = {
      text: `DELETE FROM message WHERE lobby_id = $1 ${typeCondition}`,
      values,
    };

    await db.deleteQuery(queryString, client);
  };

  /**
   * Matchmaking for rankeds
   * @param {int} playerTierWeight Weight of the player
   * @param {boolean} isPromotion True if player is in promotion, false otherwise
   * @returns
   */
  rankedMatchmaking = async (playerTierWeight, isPromotion) => {
    let weightCondition = `
      AND t.weight <= $4 + 1
      AND t.weight >= $4 - 1
      `;

    if (isPromotion) weightCondition = `AND t.weight = $4 - 1`;

    const matchmakingQuery = {
      text: `
      SELECT p.*
      FROM player p
      INNER JOIN lobby l
        ON l.created_by = p.id
      INNER JOIN rating r
        ON r.guild_id = l.guild_id AND r.player_id = l.created_by
      INNER JOIN tier t
        ON t.id = r.tier_id
      WHERE l.guild_id = $1
      AND l.status = 'SEARCHING'
      AND l.id <> $2
      AND l.ranked
      AND NOT EXISTS ( 
        SELECT 1 FROM player_reject pr 
        WHERE (pr.rejected_player_id = $3 AND pr.rejecter_player_id = p.id)
        OR (pr.rejected_player_id = p.id AND pr.rejecter_player_id = $3)
      )
      ${weightCondition}
      `,
      values: [this.guildId, this.id, this.createdBy, playerTierWeight],
    };

    const matchmakingResult = await db.getQuery(matchmakingQuery);

    if (matchmakingResult == null) return null;

    const { getPlayer } = require("./player");
    return await getPlayer(matchmakingResult.id, false);
  };

  /**
   * Get someone to match to. If tierId is null, check all tiers
   * @param {int} tierId Tier id, if should check only one tier. Leave null if you want to check all tiers
   * @returns Player matched
   */
  matchmaking = async (tierId = null) => {
    // Check YuzuPlayer
    const ypQuery = {
      text: `SELECT yp.* FROM yuzu_player yp
          INNER JOIN lobby l
          ON l.created_by = yp.player_id
          WHERE l.id = $1 AND yp.guild_id = $2`,
      values: [this.id, this.guildId],
    };

    const ypResult = await db.getQuery(ypQuery);

    let yp = null;
    if (ypResult) yp = new YuzuPlayer(ypResult);

    const values = [this.guildId, this.id, this.createdBy, !!yp?.yuzu, !!yp?.parsec];

    // Tier Conditions
    let tierCondition = "";

    if (tierId) {
      tierCondition = "AND tier.id = $6";
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
      SELECT player.*
      FROM lobby_player
      INNER JOIN player
      ON player.id = lobby_player.player_id
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
      AND (NOT tier.yuzu OR yuzu_player.parsec = $4 OR yuzu_player.yuzu = $5)
      AND NOT EXISTS ( 
        SELECT 1 FROM player_reject pr 
        WHERE (pr.rejected_player_id = $3 AND pr.rejecter_player_id = player.id)
        OR (pr.rejected_player_id = player.id AND pr.rejecter_player_id = $3)
      )
      ${tierCondition}
      ORDER BY tier.yuzu DESC, tier.weight ASC, lobby_tier.created_at ASC
      `,
      values,
    };

    const matchmakingResult = await db.getQuery(matchmakingQuery);

    if (matchmakingResult == null) return null;

    const { getPlayer } = require("./player");
    return await getPlayer(matchmakingResult.id, false);
  };

  /**
   * To be called after a match has been found.
   * Sets up the lobby statuses and lobby players
   * @param {Player} opponent
   * @param {boolean} foundRanked True if the match being setup is ranked
   */
  setupMatch = async (opponent, foundRanked = false) => {
    const client = await db.getClient();

    // Update status
    try {
      await client.query("BEGIN");
      await this.setStatus("CONFIRMATION", client);
      const mode = foundRanked ? "RANKED" : "FRIENDLIES";
      await this.setMode(mode, client);

      const oppLobby = await opponent.getOwnLobby(client);
      if (!oppLobby) throw Error("matchmakingNoOppLobby");

      await oppLobby.setStatus("WAITING", client);
      await oppLobby.setLobbyPlayersStatus("WAITING", client);
      await this.addPlayer(opponent.id, "CONFIRMATION", client);
      await this.setLobbyPlayersStatus("CONFIRMATION", client);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
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

  /**
   * Get the ranked message (iff this lobby is ranked)
   * @param {Client} client Optional PG client
   */
  getRankedMessage = async (client = null) => {
    const message = await db.getBy(
      "message",
      {
        lobby_id: this.id,
        ranked: true,
        type: MESSAGE_TYPES.LOBBY_RANKED_SEARCH,
        player_id: this.createdBy,
      },
      client
    );

    if (!message) return null;
    else return new Message(message);
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

  /**
   * Returns the Search Tier Messages
   * from all lobby players in this lobby
   * @param {MESSAGE_TYPES} type Message type. Returns all if null
   * @param {Client} client Optional pg client
   * @returns Array of Messages of this lobby
   */
  getMessagesFromEveryone = async (type = null, client = null) => {
    const values = [this.id];

    let typeCondition = "";
    if (type !== null) {
      typeCondition = `AND m.type = $2`;
      values.push(type);
    }

    const queryString = {
      text: `SELECT m.*
      FROM message m
      INNER JOIN lobby_player lp
        ON m.player_id = lp.player_id
      WHERE lp.lobby_id = $1
      ${typeCondition}`,
      values,
    };

    const result = await db.getQuery(queryString, client, true);
    return result.map((message) => new Message(message));
  };

  /**
   * Sets the lobbyId of all lobbyTier messages from all
   * players in this lobby to this current lobby
   * @param {Client} client Optional pg client
   */
  setLobbyForAllMessages = async (client = null) => {
    const queryString = {
      text: `UPDATE message
      SET lobby_id = $1
      WHERE type = $2
      AND player_id IN (
        SELECT player_id
        FROM lobby_player
        WHERE lobby_id = $1
      )
      AND guild_id = $3
      `,
      values: [this.id, MESSAGE_TYPES.LOBBY_TIER, this.guildId],
    };

    await db.updateQuery(queryString, client);
  };

  newGameset = async (firstTo = 3, ranked = false, client = null) => {
    if (this.status !== "PLAYING") throw new Error("notPlaying");

    const insertQuery = {
      text: `
    INSERT INTO gameset(guild_id, lobby_id, first_to, ranked)
    VALUES ($1, $2, $3, $4)
    `,
      values: [this.guildId, this.id, firstTo, ranked],
    };

    await db.insertQuery(insertQuery, client);

    return await this.getGameset(client);
  };

  // ***********
  //    SETTERS
  // ************

  setChannels = async (textChannelId, voiceChannelId, client = null) => {
    const setValues = { text_channel_id: textChannelId, voice_channel_id: voiceChannelId };
    await db.updateBy("lobby", setValues, { id: this.id }, client);

    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;
  };

  setStatus = async (status, client = null) => {
    await db.updateBy("lobby", { status }, { id: this.id }, client);
    this.status = status;
  };

  setMode = async (mode, client = null) => {
    await db.updateBy("lobby", { mode }, { id: this.id }, client);
    this.mode = mode;
  };

  setRanked = async (ranked, client = null) => {
    await db.updateBy("lobby", { ranked }, { id: this.id }, client);
    this.ranked = ranked;
  };
}

const getLobby = async (lobbyId, client = null) => {
  const lobby = await db.basicGet("lobby", lobbyId, false, client);
  if (!lobby) return null;
  else return new Lobby(lobby);
};

const getLobbyByTextChannel = async (textChannelId, client = null) => {
  if (!textChannelId) return null;
  const lobby = await db.getBy("lobby", { text_channel_id: textChannelId }, client);

  if (lobby == null) return null;
  else return new Lobby(lobby);
};

module.exports = {
  Lobby,
  getLobby,
  getLobbyByTextChannel,
};
