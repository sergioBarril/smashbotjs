const db = require("./db");
const { RegionRole } = require("./regionRole");

class Region {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  // **********
  //  GETTERS
  // **********
  getRole = async (guildId, client = null) => {
    const role = await db.getBy("region_role", { region_id: this.id, guild_id: guildId }, client);

    if (role == null) return null;
    else return new RegionRole(role);
  };
}

const getRegion = async (regionId, client = null) => {
  const region = await db.basicGet("region", regionId, false, client);
  if (region == null) return null;
  else return new Region(region);
};

const getRegionByName = async (regionName, client = null) => {
  const region = await db.getBy("region", { name: regionName }, client);
  if (region == null) return null;
  else return new Region(region);
};

const getAllRegions = async (client = null) => {
  const getAllRegionsQuery = { text: `SELECT * FROM region` };

  const getAllRegionsResult = await db.getQuery(getAllRegionsQuery, client, true);
  return getAllRegionsResult.map((row) => new Region(row));
};

const create = async (regionName, client = null) => {
  const insertQuery = {
    text: `INSERT INTO region(name) VALUES ($1)`,
    values: [regionName],
  };

  await db.insertQuery(insertQuery, client);
};

module.exports = {
  getRegion,
  getRegionByName,
  getAllRegions,
  create,
  Region,
};
