const db = require("./db");

class RegionRole {
  constructor({ id, discord_id, guild_id, region_id }) {
    this.id = id;
    this.discordId = discord_id;

    this.guildId = guild_id;
    this.regionId = region_id;
  }

  // ***********
  //   SETTER
  // **********
  setDiscordId = async (roleDiscordId, client = null) => {
    await db.updateBy("region_role", { discord_id: roleDiscordId }, { id: this.id }, client);
    this.discordId = roleDiscordId;
  };
}

const getRegionRole = async (roleId, discord = false, client = null) => {
  const regionRole = await db.basicGet("region_role", roleId, discord, client);
  if (regionRole == null) return null;
  else return new RegionRole(regionRole);
};

module.exports = {
  getRegionRole,
  RegionRole,
};
