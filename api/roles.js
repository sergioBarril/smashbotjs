const { getPlayer } = require("../models/player");
const { NotFoundError } = require("../errors/notFound");
const { getGuild } = require("../models/guild");
const { getCharacterByName } = require("../models/character");
const { TooManyCharactersError } = require("../errors/tooManyCharacters");
const { CustomError } = require("../errors/customError");
const { getRegionByName } = require("../models/region");
const { TooManyRegionsError } = require("../errors/tooManyRegions");

/**
 * Assigns the region role to a player
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} regionName Name of the region
 * @param {string} guildDiscordId DiscordID of the guild
 * @returns
 */
const assignRegion = async (playerDiscordId, regionName, guildDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  const region = await getRegionByName(regionName);
  if (!region) throw new NotFoundError("Region");

  const regions = await player.getAllRegions();

  const rp = await player.getRegionPlayer(region.id);

  // Manage RegionPlayer
  let action = null;
  if (rp) {
    await rp.remove();
    action = "REMOVE";
  } else {
    if (regions.length >= 2) throw new TooManyRegionsError(regions);
    await player.insertRegion(region.id);
    action = "CREATE";
  }

  // Return role
  const regionRole = await region.getRole(guild.id);
  return { regionRoleId: regionRole.roleId, action };
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

/**
 * Toggles the yuzu / parsec roles
 * @param {string} playerDiscordId Discord ID of the player
 * @param {string} guildDiscordId Discord ID of the guild
 * @param {string} yuzuRoleName YUZU or PARSEC
 * @returns
 */
const assignYuzu = async (playerDiscordId, guildDiscordId, yuzuRoleName) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  if (!["YUZU", "PARSEC"].includes(yuzuRoleName))
    throw new CustomError("Wrong Yuzu Toggle. Contact admins.");

  const isYuzu = yuzuRoleName == "YUZU";
  let newStatus;

  const yuzuPlayer = await player.getYuzuPlayer(guild.id);
  if (!yuzuPlayer) {
    await player.insertYuzuPlayer(guild.id, isYuzu, !isYuzu);
    newStatus = true;
  } else {
    newStatus = !yuzuPlayer[yuzuRoleName.toLowerCase()];
    if (isYuzu) await yuzuPlayer.setYuzu(newStatus);
    else await yuzuPlayer.setParsec(newStatus);
  }

  const roleId = isYuzu ? guild.yuzuRoleId : guild.parsecRoleId;

  return { roleId, newStatus };
};

/**
 * Gets the yuzu role that the opponents must have to play yuzu
 * with this player
 *
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} guildDiscordId DiscordID of the guild
 * @returns An array containing:
 *  - yuzuRoleId if the player has parsec role
 *  - parsecRoleId if the player has yuzu role
 *  - both if has both
 */
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
