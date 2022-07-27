const db = require("./db");

const { CharacterPlayer } = require("./characterPlayer");

const { Lobby } = require("./lobby");
const { Rating } = require("./rating");
const { getRegion } = require("./region");
const { YuzuPlayer } = require("./yuzuPlayer");
const { Tier } = require("./tier");

const getPlayer = async (playerId, discord = false, client = null) => {
  const player = await db.basicGet("player", playerId, discord, client);

  if (player === null) return null;
  return new Player(player);
};

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
          AND lobby_player.player_id = $2
    `,
      values: [status, this.id],
    };

    const lobby = await db.getQuery(getLobbyQuery, client);
    if (lobby == null) return null;
    else return new Lobby(lobby);
  };

  getCurrentGameset = async (client = null) => {
    const { Gameset } = require("./gameset");
    const getQuery = {
      text: `SELECT gs.* FROM gameset gs
    INNER JOIN game
      ON game.gameset_id = gs.id
    INNER JOIN game_player gp
      ON gp.game_id = game.id
    WHERE gp.player_id = $1
    AND gs.winner_id IS NULL`,
      values: [this.id],
    };

    const gameset = await db.getQuery(getQuery, client);
    if (gameset == null) return null;
    else return new Gameset(gameset);
  };

  getRatingByGuild = async (guildId, client = null) => {
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

  getAllCharacterPlayers = async (client = null) => {
    const charPlayers = await db.filterBy("character_player", { player_id: this.id }, client);
    return charPlayers.map((row) => new CharacterPlayer(row));
  };

  getCharacter = async (characterId, client = null) => {
    const charPlayer = await this.getCharacterPlayer(characterId, client);
    if (charPlayer == null) return null;
    else return await charPlayer.getCharacter(client);
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
}

module.exports = {
  getPlayer,
  Player,
};
