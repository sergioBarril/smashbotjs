const db = require("./index");

const get = async (characterId, playerId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM character_player
    WHERE character_id = $1
    AND player_id = $2`,
    values: [characterId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getByType = async (playerId, type, client = null) => {
  const getQuery = {
    text: `
    SELECT character.* FROM character_player cp
    INNER JOIN character
    ON cp.character_id = character.id
    WHERE cp.player_id = $1
    AND type = $2
    `,
    values: [playerId, type],
  };
  const getResult = await (client ?? db).query(getQuery);

  return getResult.rows;
};

const getByPlayer = async (playerId, client = null) => {
  const getQuery = {
    text: `
    SELECT c.name, cp.type
    FROM character_player cp
    INNER JOIN character c
      ON c.id = cp.character_id
    WHERE cp.player_id = $1
    `,
    values: [playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const hasChar = async (charId, playerId, client = null) => {
  const getQuery = {
    text: `
    SELECT EXISTS(
      SELECT 1 FROM character_player
      WHERE character_id = $1
      AND player_id = $2
    ) AS "exists"
    `,
    values: [charId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0].exists;
};

const create = async (characterId, playerId, type, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO character_player (character_id, player_id, type)
    VALUES ($1, $2, $3)
    `,
    values: [characterId, playerId, type],
  };

  await (client ?? db).query(insertQuery);
};

const remove = async (characterId, playerId, client = null) => {
  const removeQuery = {
    text: `
    DELETE FROM character_player
    WHERE character_id = $1
    AND player_id = $2
    `,
    values: [characterId, playerId],
  };

  await (client ?? db).query(removeQuery);
};

const update = async (characterId, playerId, type, client = null) => {
  const updateQuery = {
    text: `
    UPDATE character_player
    SET type = $1
    WHERE character_id = $2
    AND player_id = $3
    `,
    values: [type, characterId, playerId],
  };

  await (client ?? db).query(updateQuery);
};

module.exports = {
  get,
  getByPlayer,
  getByType,
  hasChar,
  create,
  remove,
  update,
};
