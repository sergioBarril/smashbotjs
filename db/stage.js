const db = require("./index");

const get = async (stageId, client = null) => await db.basicGet("stage", stageId, false, client);

const getStarters = async (client = null) => {
  const getQuery = `SELECT * FROM stage WHERE starter`;

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const create = async (name, emoji, starter, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO stage(name, emoji, starter)
    VALUES ($1, $2, $3)
    `,
    values: [name, emoji, starter],
  };

  await (client ?? db).query(insertQuery);
};

module.exports = {
  get,
  getStarters,
  create,
};
