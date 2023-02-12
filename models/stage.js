const db = require("./db");

class Stage {
  constructor({ id, name, starter }) {
    this.id = id;
    this.name = name;
    this.starter = starter;
  }

  remove = async (client = null) => await db.basicRemove("stage", this.id, false, client);
}

const getStage = async (stageId, client = null) => {
  const stage = await db.basicGet("stage", stageId, false, client);
  if (stage == null) return null;
  else return new Stage(stage);
};

const getStageByName = async (stageName, client = null) => {
  const stage = await db.getBy("stage", { name: stageName }, client);
  if (stage == null) return null;
  else return new Stage(stage);
};

const getAllStages = async (client = null) => {
  const getQuery = { text: `SELECT * FROM stage`, values: [] };
  const stages = await db.getQuery(getQuery, client, true);
  return stages.map((row) => new Stage(row));
};

const getStarters = async (client = null) => {
  const starters = await db.filterBy("stage", { starter: true }, client);
  return starters.map((row) => new Stage(row));
};

const insertStage = async (name, starter, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO stage(name, starter)
    VALUES ($1, $2)
    `,
    values: [name, starter],
  };

  await db.insertQuery(insertQuery, client);
  return await getStageByName(name, client);
};

module.exports = {
  Stage,
  getStage,
  getStageByName,
  getAllStages,
  getStarters,
  insertStage,
};
