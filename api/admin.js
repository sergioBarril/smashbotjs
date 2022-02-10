const db = require("../db/index");

const guildDB = require("../db/guild");

const characterDB = require("../db/character");
const characterRoleDB = require("../db/characterRole");

const regionDB = require("../db/region");
const regionRoleDB = require("../db/regionRole");

const getAdminChannel = async (guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  return guild.admin_channel_id;
};

const upsertRoles = async (roleList, type) => {
  if (roleList.length === 0) return false;

  const guildDiscordId = roleList[0].guild.id;
  const guild = await guildDB.get(guildDiscordId, true);

  let baseDB;
  let roleDB;
  let baseIdName;

  if (type === "CHARACTERS") {
    baseDB = characterDB;
    roleDB = characterRoleDB;
    baseIdName = "character_id";
  } else if (type === "REGIONS") {
    baseDB = regionDB;
    roleDB = regionRoleDB;
    baseIdName = "region_id";
  }

  const dbBaseElements = await baseDB.getAll();
  const dbBaseNames = dbBaseElements.map((element) => element.name);
  const dbRoles = await roleDB.getByGuild(guild.id);

  let baseInserted = 0;
  let rolesInserted = 0;
  let rolesUpdated = 0;

  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    // Insert Base Elements
    for (role of roleList) {
      if (!dbBaseNames.includes(role.name)) {
        await baseDB.create(role.name, client);
        baseInserted++;
      }

      const element = await baseDB.getByName(role.name, client);
      const dbRole = dbRoles.find(
        (role) => role.guild_id == guild.id && role[baseIdName] == element.id
      );

      // Insert Character Role
      if (!dbRole) {
        await roleDB.create(role.id, element.id, guild.id, client);
        rolesInserted++;
      } else if (dbRole.discord_id != role.id) {
        await roleDB.update(role.id, element.id, guild.id, client);
        rolesUpdated++;
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return {
    baseInserted,
    rolesInserted,
    rolesUpdated,
  };
};

module.exports = {
  getAdminChannel,
  upsertRoles,
};
