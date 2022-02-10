const db = require("./index");

const get = async (characterId, client = null) =>
  await db.basicGet("character", characterId, false, client);

const getByName = async (charName, client = null) => {
  const getQuery = {
    text: ` SELECT * FROM character
    WHERE name = $1
    `,
    values: [charName],
  };
  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getAll = async (client = null) => {
  const getAllCharsQuery = {
    text: `
    SELECT * FROM character    
    `,
  };

  const getAllCharsResult = await (client ?? db).query(getAllCharsQuery);
  return getAllCharsResult.rows;
};

const create = async (characterName, client = null) => {
  const insertChar = {
    text: `
    INSERT INTO character(name)
    VALUES ($1)
    `,
    values: [characterName],
  };

  await (client ?? db).query(insertChar);
};

module.exports = {
  get,
  getByName,
  getAll,
  create,
};
