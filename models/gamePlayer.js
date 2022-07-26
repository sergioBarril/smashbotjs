const db = require("./db");

const whereConditions = { game_id: this.gameId, player_id: this.playerId };

class GamePlayer {
  constructor({ game_id, player_id, character_id, ban_turn, char_message_id, winner }) {
    this.gameId = game_id;
    this.playerId = player_id;

    this.characterId = character_id;
    this.banTurn = ban_turn;
    this.charMessageId = char_message_id;
    this.winner = winner;
  }

  getOpponent = async (client = null) => {
    const opponentGp = await db.getBy("game_player", whereConditions, client);

    if (opponentGp == null) return null;
    else return new GamePlayer(opponentGp);
  };

  setCharMessageId = async (messageId, client = null) => {
    await db.updateBy("game_player", { char_message_id: messageId }, whereConditions, client);
    this.charMessageId = messageId;
  };

  setCharacter = async (charId, client = null) => {
    await db.updateBy("game_player", { character_id: charId }, whereConditions, client);
    this.characterId = charId;
  };

  setBanTurn = async (banTurn, client = null) => {
    await db.updateBy("game_player", { ban_turn: banTurn }, whereConditions, client);
    this.banTurn = banTurn;
  };

  setWinner = async (isWinner, client = null) => {
    await db.updateBy("game_player", { winner: isWinner }, whereConditions, client);
    this.winner = isWinner;
  };
}

const createGamePlayer = async (gameId, playerId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO game_player(game_id, player_id)
    VALUES ($1, $2)
    `,
    values: [gameId, playerId],
  };

  await db.insertQuery(insertQuery, client);
};

module.exports = {
  createGamePlayer,
  GamePlayer,
};
