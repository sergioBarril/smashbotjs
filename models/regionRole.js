const db = require("./db");

class RegionRole {
  constructor({ id, role_id, guild_id, region_id }) {
    this.id = id;
    this.roleId = role_id;

    this.guildId = guild_id;
    this.regionId = region_id;
  }

  remove = async (client = null) => await db.basicRemove("region_role", this.id, false, client);

  // ***********
  //   SETTER
  // **********
  setRoleId = async (roleDiscordId, client = null) => {
    await db.updateBy("region_role", { role_id: roleDiscordId }, { id: this.id }, client);
    this.roleId = roleDiscordId;
  };
}

const getRegionRole = async (roleId, client = null) => {
  const regionRole = await db.getBy("region_role", { role_id: roleId }, client);
  if (regionRole == null) return null;
  else return new RegionRole(regionRole);
};

module.exports = {
  getRegionRole,
  RegionRole,
};
