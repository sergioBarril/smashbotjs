const { NotFoundError } = require("../errors/notFound");
const db = require("./db");
const { MESSAGE_TYPES } = require("./message");
const { getPlayer } = require("./player");

class GamePlayer {
  constructor({ game_id, player_id, character_id, ban_turn, char_message_id, winner }) {
    this.gameId = game_id;
    this.playerId = player_id;

    this.characterId = character_id;
    this.banTurn = ban_turn;
    this.winner = winner;
  }
  whereConditions = () => ({ game_id: this.gameId, player_id: this.playerId });

  getOpponent = async (client = null) => {
    const queryString = {
      text: `SELECT gp.* FROM game_player gp
      WHERE game_id = $1
      AND player_id <> $2`,
      values: [this.gameId, this.playerId],
    };

    const opponentGp = await db.getQuery(queryString, client);

    if (opponentGp == null) return null;
    else return new GamePlayer(opponentGp);
  };

  banStage = async (stageId, client = null) => {
    const insertQuery = {
      text: `INSERT INTO stage_ban(player_id, game_id, stage_id)
    VALUES($1, $2, $3)`,
      values: [this.playerId, this.gameId, stageId],
    };

    await db.insertQuery(insertQuery, client);
  };

  insertMessage = async (discordId, client = null) => {
    const player = await getPlayer(this.playerId, false, client);
    const lobby = await player.getLobby("PLAYING", client);
    if (!lobby) throw NotFoundError("Lobby");

    return await insertMessage(
      discordId,
      MESSAGE_TYPES.GAME_CHARACTER_SELECT,
      null,
      lobby.textChannelId,
      this.playerId,
      lobby.guildId,
      lobby.id,
      false,
      client
    );
  };

  setCharacter = async (charId, client = null) => {
    await db.updateBy("game_player", { character_id: charId }, this.whereConditions(), client);
    this.characterId = charId;
  };

  setBanTurn = async (banTurn, client = null) => {
    await db.updateBy("game_player", { ban_turn: banTurn }, this.whereConditions(), client);
    this.banTurn = banTurn;
  };

  setWinner = async (isWinner, client = null) => {
    await db.updateBy("game_player", { winner: isWinner }, this.whereConditions(), client);
    this.winner = isWinner;
  };
}

module.exports = {
  GamePlayer,
};
