const db = require("./index");

const get = async (regionId, playerId, client = null) => {
  const getQuery = {
    text: `SELECT * FROM region_player
    WHERE region_id = $1
    AND player_id = $2`,
    values: [regionId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getByPlayer = async (playerId, client = null) => {
  const getQuery = {
    text: `
    SELECT r.name
    FROM region_player rp
    INNER JOIN region r
      ON r.id = rp.region_id
    WHERE rp.player_id = $1
    `,
    values: [playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const hasRegion = async (regionId, playerId, client = null) => {
  const getQuery = {
    text: `
    SELECT EXISTS(
      SELECT 1 FROM region_player
      WHERE region_id = $1
      AND player_id = $2
    ) AS "exists"
    `,
    values: [regionId, playerId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0].exists;
};

const create = async (regionId, playerId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO region_player (region_id, player_id)
    VALUES ($1, $2)
    `,
    values: [regionId, playerId],
  };

  await (client ?? db).query(insertQuery);
};

const remove = async (regionId, playerId, client = null) => {
  const removeQuery = {
    text: `
    DELETE FROM region_player
    WHERE region_id = $1
    AND player_id = $2
    `,
    values: [regionId, playerId],
  };

  await (client ?? db).query(removeQuery);
};

module.exports = {
  get,
  getByPlayer,
  hasRegion,
  create,
  remove,
};
