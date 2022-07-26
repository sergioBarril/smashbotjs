const { getRegion } = require("./region");
const db = require("./db");

class RegionPlayer {
  constructor({ region_id, player_id }) {
    this.regionId = region_id;
    this.playerId = player_id;
  }
  // **********
  //  GETTERS
  // *********
  getRegionName = async (client = null) => {
    const region = await getRegion(this.regionId, client);
    return region?.name;
  };

  // ***********
  //   SETTER
  // **********

  remove = async (client = null) => {
    const removeQuery = {
      text: `
    DELETE FROM region_player
    WHERE region_id = $1
    AND player_id = $2
    `,
      values: [this.regionId, this.playerId],
    };
    await db.deleteQuery(removeQuery, client);
  };
}

const create = async (regionId, playerId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO region_player (region_id, player_id)
    VALUES ($1, $2)
    `,
    values: [regionId, playerId],
  };
  await db.insertQuery(insertQuery, client);
};

module.exports = {
  create,
  RegionPlayer,
};
