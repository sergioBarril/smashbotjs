const { getPlayer } = require("../models/player");
const { NotFoundError } = require("../errors/notFound");
const { getGuild } = require("../models/guild");
const { getCharacterByName } = require("../models/character");
const { TooManyCharactersError } = require("../errors/tooManyCharacters");

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

/**
 * Assigns a character role to a player
 * @param {string} playerDiscordId Discord ID of the player
 * @param {string} characterName Character name
 * @param {string} guildDiscordId Discord ID of the guild
 * @param {string} type MAIN, SECOND or POCKET
 * @returns
 */
const assignCharacter = async (playerDiscordId, characterName, guildDiscordId, type) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  const character = await getCharacterByName(characterName);
  if (!character) throw new NotFoundError("Character");

  const mains = await player.getCharactersByType("MAIN");
  const seconds = await player.getCharactersByType("SECOND");
  const pockets = await player.getCharactersByType("POCKET");

  const cp = await player.getCharacterPlayer(character.id);

  let action = null;
  // Manage ChacterPlayer
  if (cp && cp.type === type) {
    await cp.remove();
    action = "REMOVE";
  } else {
    if (type === "MAIN" && mains.length >= 2) throw new TooManyCharactersError(type, mains);
    if (type === "SECOND" && seconds.length >= 3) throw new TooManyCharactersError(type, seconds);
    if (type === "POCKET" && pockets.length >= 5) throw new TooManyCharactersError(type, pockets);
    if (cp) {
      await cp.setType(type);
      action = "UPDATE";
    } else {
      await player.insertCharacter(character.id, type);
      action = "CREATE";
    }
  }

  // Return role id
  const characterRole = await character.getRole(guild.id);
  if (!characterRole) throw NotFoundError("CharacterRole");
  return { characterRole, action };
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

const getYuzuRolesForMessage = async (playerDiscordId, guildDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  const yuzuPlayer = await player.getYuzuPlayer(guild.id);
  if (!yuzuPlayer) throw new NotFoundError("YuzuPlayer");

  const roles = [];
  if (yuzuPlayer.parsec) roles.push(guild.yuzuRoleId);
  if (yuzuPlayer.yuzu) roles.push(guild.parsecRoleId);

  return roles;
};

/**
 * Get the characters associated with a player
 * @param {string} playerDiscordId Discord ID of the player
 * @returns Object with three arrays: mains, seconds and pockets.
 */
const getCharacters = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const mains = await player.getCharactersByType("MAIN");
  const seconds = await player.getCharactersByType("SECOND");
  const pockets = await player.getCharactersByType("POCKET");

  return { mains, seconds, pockets };
};

module.exports = {
  assignCharacter,
  assignRegion,
  assignYuzu,
  getYuzuRolesForMessage,
  getCharacters,
};
