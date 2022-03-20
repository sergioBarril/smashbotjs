const db = require("../db/index");

const playerDB = require("../db/player");
const guildDB = require("../db/guild");
const characterDB = require("../db/character");
const characterRoleDB = require("../db/characterRole");
const characterPlayerDB = require("../db/characterPlayer");

const regionDB = require("../db/region");
const regionRoleDB = require("../db/regionRole");
const regionPlayerDB = require("../db/regionPlayer");

const yuzuPlayerDB = require("../db/yuzuPlayer");

const assignRegion = async (playerDiscordId, regionName, guildDiscordId) => {
  // Assigns a player a role
  const player = await playerDB.get(playerDiscordId, true);
  const guild = await guildDB.get(guildDiscordId, true);

  const region = await regionDB.getByName(regionName);
  if (!region) throw { name: "DB_ERR_NO_REGION" };

  const regions = await regionPlayerDB.getByPlayer(player.id);

  const rp = await regionPlayerDB.get(region.id, player.id);

  let action = null;
  // Add region
  if (rp) {
    await regionPlayerDB.remove(region.id, player.id);
    action = "REMOVE";
  } else {
    if (regions.length >= 2) throw { name: "TOO_MANY_REGIONS", args: { current: regions } };
    await regionPlayerDB.create(region.id, player.id);
    action = "CREATE";
  }

  // Return role id
  const regionRole = await regionRoleDB.getByRegion(region.id, guild.id);
  return { roleId: regionRole.discord_id, action };
};

const assignCharacter = async (playerDiscordId, characterName, guildDiscordId, type) => {
  // Assigns a player a role
  const player = await playerDB.get(playerDiscordId, true);
  const guild = await guildDB.get(guildDiscordId, true);

  const character = await characterDB.getByName(characterName);
  if (!character) throw { name: "DB_ERR_NO_CHAR" };

  const mains = await characterPlayerDB.getByType(player.id, "MAIN");
  const seconds = await characterPlayerDB.getByType(player.id, "SECOND");
  const pockets = await characterPlayerDB.getByType(player.id, "POCKET");

  const cp = await characterPlayerDB.get(character.id, player.id);

  let action = null;
  // Add main
  if (cp && cp.type === type) {
    await characterPlayerDB.remove(character.id, player.id);
    action = "REMOVE";
  } else {
    if (type === "MAIN" && mains.length >= 2)
      throw { name: "TOO_MANY_MAINS", args: { current: mains } };
    if (type === "SECOND" && seconds.length >= 3)
      throw { name: "TOO_MANY_SECONDS", args: { current: seconds } };
    if (type === "POCKET" && pockets.length >= 5)
      throw { name: "TOO_MANY_POCKETS", args: { current: pockets } };

    if (cp) {
      await characterPlayerDB.update(character.id, player.id, type);
      action = "UPDATE";
    } else {
      await characterPlayerDB.create(character.id, player.id, type);
      action = "CREATE";
    }
  }

  // Return role id
  const characterRole = await characterRoleDB.getByChar(character.id, guild.id);
  return { roleId: characterRole.discord_id, action };
};

const assignYuzu = async (playerDiscordId, guildDiscordId, yuzuRoleName) => {
  const player = await playerDB.get(playerDiscordId, true);
  const guild = await guildDB.get(guildDiscordId, true);

  if (!["YUZU", "PARSEC"].includes(yuzuRoleName))
    throw { name: "WRONG_YUZU_TOGGLE", args: { yuzuRoleName } };

  const isYuzu = yuzuRoleName == "YUZU";
  let newStatus;

  const yuzuPlayer = await yuzuPlayerDB.get(player.id, guild.id);
  if (!yuzuPlayer) {
    await yuzuPlayerDB.create(player.id, guild.id, isYuzu, !isYuzu);
    newStatus = true;
  } else {
    newStatus = !yuzuPlayer[yuzuRoleName.toLowerCase()];
    await yuzuPlayerDB.setRole(player.id, guild.id, yuzuRoleName, newStatus);
  }

  const roleId = isYuzu ? guild.yuzu_role_id : guild.parsec_role_id;

  return { roleId, newStatus };
};

const getYuzuMessageRoles = async (playerDiscordId, guildDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const guild = await guildDB.get(guildDiscordId, true);

  const yuzuPlayer = await yuzuPlayerDB.get(player.id, guild.id);
  const roles = [];
  if (yuzuPlayer.parsec) roles.push(guild.yuzu_role_id);
  if (yuzuPlayer.yuzu) roles.push(guild.parsec_role_id);

  return roles;
};

const getCharacters = async (playerDiscordId, guildDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);

  const mains = await characterPlayerDB.getByType(player.id, "MAIN");
  const seconds = await characterPlayerDB.getByType(player.id, "SECOND");
  const pockets = await characterPlayerDB.getByType(player.id, "POCKET");

  return { mains, seconds, pockets };
};

module.exports = {
  assignCharacter,
  assignRegion,
  assignYuzu,
  getYuzuMessageRoles,
  getCharacters,
};
