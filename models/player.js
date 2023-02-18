const db = require("./db");

const { CharacterPlayer } = require("./characterPlayer");

const { Lobby } = require("./lobby");
const { Rating } = require("./rating");
const { getRegion } = require("./region");
const { YuzuPlayer } = require("./yuzuPlayer");
const { Tier } = require("./tier");
const { RegionPlayer } = require("./regionPlayer");
const { Client } = require("pg");
const { PlayerReject } = require("./playerReject");
const { NotFoundError } = require("../errors/notFound");

class Player {
  constructor({ id, discord_id }) {
    this.id = id;
    this.discordId = discord_id;
  }

  getTier = async (guildId, client = null) => {
    const getQuery = {
      text: `
      SELECT tier.* FROM tier
      INNER JOIN rating on tier.id = rating.tier_id 
      WHERE rating.player_id = $1
      AND rating.guild_id = $2`,
      values: [this.id, guildId],
    };

    const tier = await db.getQuery(getQuery, client);
    if (tier == null) return null;
    else return new Tier(tier);
  };

  getOwnLobby = async (client = null) => {
    const lobby = await db.getBy("lobby", { created_by: this.id }, client);
    if (lobby == null) return null;
    else return new Lobby(lobby);
  };

  getOwnLobbyOrThrow = async (client = null) => {
    const lobby = await this.getOwnLobby(client);
    if (!lobby) throw new NotFoundError("Lobby");

    return lobby;
  };

  removeOwnLobby = async (client = null) => {
    const lobby = await this.getOwnLobby(client);
    if (!lobby) return false;
    else return await db.basicRemove("lobby", lobby.id, false, client);
  };

  getLobby = async (status, client = null) => {
    const getLobbyQuery = {
      text: `
          SELECT lobby.* FROM lobby
          INNER JOIN lobby_player lp
            ON lp.lobby_id = lobby.id
          WHERE lobby.status = $1
          AND lp.player_id = $2
    `,
      values: [status, this.id],
    };

    const lobby = await db.getQuery(getLobbyQuery, client);
    if (!lobby) return null;
    else return new Lobby(lobby);
  };

  getLobbyOrThrow = async (status, context = null, client = null) => {
    const lobby = await this.getLobby(status, client);
    if (!lobby) throw new NotFoundError("Lobby", context);

    return lobby;
  };

  getCurrentGameset = async (client = null) => {
    const { Gameset } = require("./gameset");
    const getQuery = {
      //   text: `SELECT gs.* FROM gameset gs
      // // INNER JOIN game
      // //   ON game.gameset_id = gs.id
      // // INNER JOIN game_player gp
      // //   ON gp.game_id = game.id
      // // WHERE gp.player_id = $1
      // // AND gs.winner_id IS NULL`,
      text: `SELECT gs.* FROM gameset gs
            INNER JOIN lobby
              ON gs.lobby_id = lobby.id
            INNER JOIN lobby_player lp
              ON lp.lobby_id = lobby.id
            WHERE lp.player_id = $1
            AND gs.finished_at IS NULL
            AND gs.winner_id IS NULL    
      `,
      values: [this.id],
    };

    const gameset = await db.getQuery(getQuery, client);
    if (gameset == null) return null;
    else return new Gameset(gameset);
  };

  /**
   * Get a count of all ranked sets played today against the given opponent
   * @param {int} opponentPlayerId Player.id of the opponent
   * @param {*} client Optional PG Client
   * @returns
   */
  getRankedCountToday = async (opponentPlayerId, client = null) => {
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    const getQuery = {
      text: `SELECT COUNT(1) as count FROM (
	        SELECT gs.id, gp1.player_id, gp2.player_id FROM gameset gs
          INNER JOIN game g
	          ON g.gameset_id = gs.id
          INNER JOIN game_player gp1
	          ON g.id = gp1.game_id
          INNER JOIN game_player gp2
	          ON g.id = gp2.game_id
          WHERE gs.created_at > $1
          AND gp1.player_id = $2
          AND gp2.player_id = $3
          AND gs.ranked
          GROUP BY gs.id, gp1.player_id, gp2.player_id          
        ) x`,
      values: [formattedToday, this.id, opponentPlayerId],
    };

    const result = await db.getQuery(getQuery, client);
    if (result == null) return null;
    else return Number(result.count);
  };

  insertRating = async (guildId, tierId, score, client = null) => {
    const insertQuery = {
      text: `
    INSERT INTO rating(player_id, guild_id, tier_id, score)
    VALUES ($1, $2, $3, $4)
    `,
      values: [this.id, guildId, tierId, score],
    };

    await db.insertQuery(insertQuery, client);
    return await this.getRating(guildId, client);
  };

  insertCharacter = async (characterId, type, client = null) => {
    const insertQuery = {
      text: `
    INSERT INTO character_player (character_id, player_id, type)
    VALUES ($1, $2, $3)
    `,
      values: [characterId, this.id, type],
    };
    await db.insertQuery(insertQuery, client);

    return await this.getCharacterPlayer(characterId);
  };

  insertRegion = async (regionId, client = null) => {
    const insertQuery = {
      text: `
    INSERT INTO region_player (region_id, player_id)
    VALUES ($1, $2)
    `,
      values: [regionId, this.id],
    };
    await db.insertQuery(insertQuery, client);

    return await this.getRegionPlayer(regionId);
  };

  insertLobby = async (guildId, mode = "FRIENDLIES", status = "SEARCHING", ranked = false) => {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      const insertLobby = {
        text: `
        INSERT INTO lobby(status, guild_id, mode, created_by, ranked)
        VALUES ($1, $2, $3, $4, $5)
      `,
        values: [status, guildId, mode, this.id, ranked],
      };
      await db.insertQuery(insertLobby, client);

      const lobby = await this.getOwnLobby(client);
      await lobby.addPlayer(this.id, status, client);

      await client.query("COMMIT");
      return lobby;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  };

  /**
   * Checks if this player has rejected another
   * @param {int} rejectedPlayerId PlayerID of the rejected player
   * @param {Client} client Optional PG client
   */
  hasRejected = async (rejectedPlayerId, client = null) => {
    const pr = await this.getRejected(rejectedPlayerId, client);
    return pr != null;
  };

  /**
   * Get playerReject
   */
  getRejected = async (rejectedPlayerId, client = null) => {
    const pr = await db.getBy(
      "player_reject",
      {
        rejected_player_id: rejectedPlayerId,
        rejecter_player_id: this.id,
      },
      client
    );

    if (!pr) return null;
    else return new PlayerReject(pr);
  };

  /**
   * Rejects the player
   * @param {int} rejectedPlayerId PlayerID of the rejected player
   * @param {Client} client Optional PG client
   */
  rejectPlayer = async (rejectedPlayerId, client = null) => {
    const pr = await this.getRejected(rejectedPlayerId, client);
    if (pr) {
      return await pr.setRejectedAt();
    }

    const queryString = {
      text: `INSERT INTO player_reject(rejected_player_id, rejecter_player_id)
      VALUES ($1, $2)`,
      values: [rejectedPlayerId, this.id],
    };

    await db.insertQuery(queryString, client);
    return this.getRejected(rejectedPlayerId, client);
  };

  getRating = async (guildId, client = null) => {
    const getRatingQuery = {
      text: `SELECT * FROM rating
        WHERE player_id = $1 
        AND guild_id = $2`,
      values: [this.id, guildId],
    };

    const rating = await db.getQuery(getRatingQuery, client);
    if (rating == null) return null;
    else return new Rating(rating);
  };

  hasLobbyPlayer = async (client = null) => {
    const lps = await db.filterBy("lobby_player", { player_id: this.id }, client);
    return lps.length > 0;
  };

  getCharacterPlayer = async (characterId, client = null) => {
    const charPlayer = await db.getBy(
      "character_player",
      { player_id: this.id, character_id: characterId },
      client
    );

    if (charPlayer == null) return null;
    else return new CharacterPlayer(charPlayer);
  };

  getRegionPlayer = async (regionId, client = null) => {
    const regionPlayer = await db.getBy(
      "region_player",
      { player_id: this.id, region_id: regionId },
      client
    );

    if (regionPlayer == null) return null;
    else return new RegionPlayer(regionPlayer);
  };

  getAllCharacterPlayers = async (client = null) => {
    const charPlayers = await db.filterBy("character_player", { player_id: this.id }, client);
    return charPlayers.map((row) => new CharacterPlayer(row));
  };

  getCharactersByType = async (type, client = null) => {
    const charPlayers = await this.getAllCharacterPlayers(client);
    return await Promise.all(
      charPlayers.filter((cp) => cp.type === type).map(async (cp) => await cp.getCharacter(client))
    );
  };

  getRegion = async (regionId, client = null) => {
    const whereCondition = { player_id: this.id, region_id: regionId };
    const regionPlayer = await db.getBy("region_player", whereCondition, client);

    if (regionPlayer == null) return null;
    else return await getRegion(regionPlayer.region_id, client);
  };

  getAllRegions = async (client = null) => {
    const regionPlayers = await db.filterBy("region_player", { player_id: this.id }, client);
    return await Promise.all(
      regionPlayers.map(async (regionPlayer) => await getRegion(regionPlayer.region_id, client))
    );
  };

  getYuzuPlayer = async (guildId, client = null) => {
    const yp = await db.getBy("yuzu_player", { player_id: this.id, guild_id: guildId }, client);
    if (yp == null) return null;
    else return new YuzuPlayer(yp);
  };

  canSearchYuzu = async (guildId, client = null) => {
    const yuzuPlayer = await this.getYuzuPlayer(guildId, client);
    return yuzuPlayer && (yuzuPlayer.yuzu || yuzuPlayer.parsec);
  };

  insertYuzuPlayer = async (guildId, yuzu, parsec, client = null) => {
    const insertQuery = {
      text: `
    INSERT INTO yuzu_player(player_id, guild_id, yuzu, parsec)
    VALUES ($1, $2, $3, $4)
    `,
      values: [this.id, guildId, yuzu, parsec],
    };

    await db.insertQuery(insertQuery, client);
    return await this.getYuzuPlayer(guildId, client);
  };

  remove = async (client = null) => await db.basicRemove("player", this.id, false, client);
}

const insertPlayer = async (playerDiscordId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO player (discord_id)
    VALUES ($1)
    `,
    values: [playerDiscordId],
  };

  await db.insertQuery(insertQuery, client);
  return await getPlayer(playerDiscordId, true, client);
};

/**
 * Get a player.
 * @param {*} playerId
 * @param {boolean} discord
 * @param {Client} client
 * @returns Player object if found, null if not
 */
const getPlayer = async (playerId, discord = false, client = null) => {
  const player = await db.basicGet("player", playerId, discord, client);
  if (!player) return null;
  return new Player(player);
};

const getPlayerOrThrow = async (playerId, discord = false, client = null) => {
  const player = await getPlayer(playerId, discord, client);
  if (!player) throw new NotFoundError("Player", null, playerId);

  return player;
};

module.exports = {
  Player,
  getPlayer,
  getPlayerOrThrow,
  insertPlayer,
};
