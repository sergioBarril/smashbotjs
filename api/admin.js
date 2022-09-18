const { getGuild } = require("../models/guild");
const { NotFoundError } = require("../errors/notFound");
const { getAllCharacters, insertCharacter, getCharacterByName } = require("../models/character");
const { getAllRegions, insertRegion, getRegionByName } = require("../models/region");
const db = require("../models/db");

const upsertRoles = async (roleList, type) => {
  if (roleList.length === 0) return false;

  const guildDiscordId = roleList[0].guild.id;
  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  let baseIdName;

  let allElements;
  let allRoles;
  let createElement;
  let getElementByName;
  let elementIdName;

  if (type === "CHARACTERS") {
    allElements = await getAllCharacters();
    allRoles = await guild.getCharacterRoles();
    createElement = insertCharacter;
    getElementByName = getCharacterByName;
    elementIdName = "characterId";
  } else if (type === "REGIONS") {
    allElements = await getAllRegions();
    allRoles = await guild.getRegionRoles();
    createElement = insertRegion;
    getElementByName = getRegionByName;
    elementIdName = "regionId";
  }

  const elementNames = allElements.map((element) => element.name);

  let baseInserted = 0;
  let rolesInserted = 0;
  let rolesUpdated = 0;

  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    // Insert Base Elements
    for (let role of roleList) {
      if (!elementNames.includes(role.name)) {
        await createElement(role.name, client);
        baseInserted++;
      }

      const element = await getElementByName(role.name, client);
      const dbRole = allRoles.find((role) => role[baseIdName] == element.id);

      // Insert Character Role
      if (!dbRole) {
        await element.insertRole(role.id, guild.id, client);
        rolesInserted++;
      } else if (dbRole.roleId != role.id) {
        await dbRole.setRoleId(role.id, client);
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
  upsertRoles,
};
