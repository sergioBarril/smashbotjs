const db = require("./index");

const get = async (stageId, client = null) => await db.basicGet("stage", stageId, false, client);

const getByName = async (stageName, client = null) => {
  const getQuery = {
    text: ` SELECT * FROM stage
    WHERE name = $1
    `,
    values: [stageName],
  };
  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getAll = async (client = null) => {
  const getQuery = `SELECT * FROM stage`;
  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const getStarters = async (client = null) => {
  const getQuery = `SELECT * FROM stage WHERE starter`;

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const create = async (name, starter, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO stage(name, starter)
    VALUES ($1, $2, $3)
    `,
    values: [name, emoji, starter],
  };

  await (client ?? db).query(insertQuery);
};

module.exports = {
  get,
  getByName,
  getAll,
  getStarters,
  create,
};
