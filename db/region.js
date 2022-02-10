const db = require("./index");

const get = async (characterId, client = null) =>
  await db.basicGet("region", characterId, false, client);

const getByName = async (regionName, client = null) => {
  const getQuery = {
    text: ` SELECT * FROM region
    WHERE name = $1
    `,
    values: [regionName],
  };
  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getAll = async (client = null) => {
  const getAllQuery = {
    text: `
    SELECT * FROM region
    `,
  };

  const getAllResult = await (client ?? db).query(getAllQuery);
  return getAllResult.rows;
};

const create = async (regionName, client = null) => {
  const insert = {
    text: `
    INSERT INTO region(name)
    VALUES ($1)
    `,
    values: [regionName],
  };

  await (client ?? db).query(insert);
};

module.exports = {
  get,
  getByName,
  getAll,
  create,
};
