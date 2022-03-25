const db = require("./index");

const get = async (gameId, playerId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM game_player
    WHERE game_id = $1 AND player_id = $2`,
    values: [gameId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getOpponent = async (gameId, playerId, client = null) => {
  const getQuery = {
    text: `SELECT player.*, gp.winner AS winner, c.name
    FROM game_player gp
    INNER JOIN player
      ON player.id = gp.player_id
    LEFT JOIN character c
      ON c.id = gp.character_id
    WHERE gp.game_id = $1
    AND gp.player_id <> $2`,
    values: [gameId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getPlayersAndCharacters = async (gameId, client = null) => {
  const getQuery = {
    text: `SELECT p.discord_id AS discord_id, c.name AS character_name
    FROM game_player gp
    INNER JOIN player p
      ON gp.player_id = p.id
    INNER JOIN character c
      ON c.id = gp.character_id
    WHERE gp.game_id = $1
    ORDER BY p.discord_id ASC`,
    values: [gameId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const getCharMessages = async (gameId, client = null) => {
  const getQuery = {
    text: `SELECT char_message FROM game_player
    WHERE game_id = $1`,
    values: [gameId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const setCharMessage = async (gameId, playerId, messageId, client = null) => {
  const updateQuery = {
    text: `UPDATE game_player
    SET char_message = $1
    WHERE game_id = $2
    AND player_id = $3`,
    values: [messageId, gameId, playerId],
  };

  await (client ?? db).query(updateQuery);
};

const setNullCharMessages = async (gameId, client = null) => {
  const updateQuery = {
    text: `UPDATE game_player
    SET char_message = NULL
    WHERE game_id = $1`,
    values: [gameId],
  };

  await (client ?? db).query(updateQuery);
};

const setCharacter = async (gameId, playerId, charId, client = null) => {
  const updateQuery = {
    text: `UPDATE game_player
    SET character_id = $1
    WHERE game_id = $2
    AND player_id = $3`,
    values: [charId, gameId, playerId],
  };

  await (client ?? db).query(updateQuery);
};

const setBanTurn = async (gameId, playerId, banTurn, client = null) => {
  const updateQuery = {
    text: `UPDATE game_player
    SET ban_turn = $1
    WHERE game_id = $2
    AND player_id = $3`,
    values: [banTurn, gameId, playerId],
  };

  await (client ?? db).query(updateQuery);
};

const setWinner = async (gameId, playerId, isWinner, client = null) => {
  const updateQuery = {
    text: `UPDATE game_player
    SET winner = $1
    WHERE game_id = $2
    AND player_id = $3`,
    values: [isWinner, gameId, playerId],
  };

  await (client ?? db).query(updateQuery);
};

const create = async (gameId, playerId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO game_player(game_id, player_id)
    VALUES ($1, $2)
    `,
    values: [gameId, playerId],
  };

  await (client ?? db).query(insertQuery);
};

module.exports = {
  get,
  create,
  getOpponent,
  getPlayersAndCharacters,
  setCharacter,
  getCharMessages,
  setCharMessage,
  setNullCharMessages,
  setBanTurn,
  setWinner,
};
