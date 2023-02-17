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

  getRegion = async (client = null) => await getRegion(this.regionId, client);

  getPlayer = async (client = null) => {
    const { getPlayer } = require("./player");
    return await getPlayer(this.playerId, false, client);
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

module.exports = {
  RegionPlayer,
};
