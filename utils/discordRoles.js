const smashCharacters = require("../params/smashCharacters.json");
const spanishRegions = require("../params/spanishRegions.json");

const { normalizeCharacter, normalizeRegion } = require("./normalize");

const rolesAPI = require("../api/roles");
const { CharacterNameError } = require("../errors/characterName");
const { Interaction } = require("discord.js");
const { CustomError } = require("../errors/customError");
const { RegionNameError } = require("../errors/regionName");
const { getWifiTier } = require("../api/guild");
const { NotFoundError } = require("../errors/notFound");

const YUZU_EMOJI = "<:yuzu:945850935035441202>";
const PARSEC_EMOJI = "<:parsec:945853565405114510>";
const WIFI_EMOJI = "<:wifi:945988666994602065>";

const exceptionHandler = async (interaction, exception) => {
  let message = exception.message;

  if (!(exception instanceof CustomError)) {
    message = "Ha habido un error inesperado. Habla con un admin para que mire los logs.";
    console.error(exception, exception.stack);
  }

  await interaction.followUp({
    content: message,
    ephemeral: true,
  });
};

/**
 * Assigns (or removes) a character for a player
 * @param {Interaction} interaction DiscordJs interaction
 * @param {string} characterName Character name
 * @param {string} type MAIN, SECOND or POCKET
 * @returns
 */
const assignCharacter = async (interaction, characterName, type) => {
  const key = normalizeCharacter(characterName);
  if (!key) throw new CharacterNameError(characterName);

  const player = interaction.user;
  const guild = interaction.guild;

  const { characterRole, action } = await rolesAPI.assignCharacter(player.id, key, guild.id, type);

  // Manage discord role
  const role = await guild.roles.fetch(characterRole.roleId);
  const member = interaction.member;

  if (action === "REMOVE") await member.roles.remove(role);
  else await member.roles.add(role);

  // Response
  const emoji = smashCharacters[key].emoji;

  if (action === "CREATE")
    return `Te he asignado a **${key}** ${emoji} como ${type.toLowerCase()}.`;
  else if (action === "UPDATE")
    return `**${key}** ${emoji} ha pasado a ser tu ${type.toLowerCase()}.`;
  else if (action === "REMOVE") return `**${key}** ${emoji} ya no será tu ${type.toLowerCase()}.`;
};

/**
 * Assigns a region to a player
 * @param {Interaction} interaction DiscordJS interaction
 * @param {string} name Region name
 * @returns
 */
const assignRegion = async (interaction, name) => {
  const key = normalizeRegion(name);
  if (!key) throw new RegionNameError(name);

  const player = interaction.user;
  const guild = interaction.guild;

  const { regionRoleId, action } = await rolesAPI.assignRegion(player.id, key, guild.id);

  const role = await guild.roles.fetch(regionRoleId);
  const member = interaction.member;

  if (action === "REMOVE") await member.roles.remove(role);
  else await member.roles.add(role);

  // Response
  let emoji = spanishRegions[key].emoji;

  if (action === "CREATE") return `Te he asignado la región **${key}** ${emoji}.`;
  else return `Ya no estás en la región de **${key}** ${emoji}.`;
};

/**
 * Assigns yuzu role
 * @param {Interaction} interaction DiscordJS interaction
 * @param {string} name YUZU or PARSEC
 * @returns
 */
const assignYuzu = async (interaction, name) => {
  const player = interaction.member;
  const guild = interaction.guild;

  const { roleId, newStatus } = await rolesAPI.assignYuzu(player.id, guild.id, name);

  const isYuzu = name == "YUZU";
  const emoji = isYuzu ? YUZU_EMOJI : PARSEC_EMOJI;

  // Get changed role
  const role = await guild.roles.fetch(roleId);
  if (newStatus) {
    await player.roles.add(role);
    return `Te he añadido el rol **${role}** ${emoji}.`;
  } else {
    await player.roles.remove(role);
    return `Te he quitado el rol **${role}** ${emoji}.`;
  }
};

/**
 * Assigns wifi role
 * @param {Interaction} interaction DiscordJS interaction
 * @returns
 */
const assignWifi = async (interaction) => {
  const player = interaction.member;
  const guild = interaction.guild;

  const wifiTier = await getWifiTier(guild.id);

  if (!wifiTier) throw NotFoundError("WifiTier");

  // Get changed role
  const role = await guild.roles.fetch(wifiTier.roleId);
  await player.fetch();

  if (player.roles.cache.has(role.id)) {
    await player.roles.remove(role);
    return `Te he quitado el rol **${role}** ${WIFI_EMOJI}.`;
  } else {
    await player.roles.add(role);
    return `Te he añadido el rol **${role}** ${WIFI_EMOJI}.`;
  }
};

const assignRole = async (interaction, name, type) => {
  let responseText;
  await interaction.deferReply({ ephemeral: true });

  try {
    if (["MAIN", "SECOND", "POCKET"].includes(type))
      responseText = await assignCharacter(interaction, name, type);
    else if (type === "REGION") responseText = await assignRegion(interaction, name);
    else if (type === "YUZU") responseText = await assignYuzu(interaction, name);
    else if (type === "WIFI") responseText = await assignWifi(interaction, name);

    return await interaction.editReply({
      content: responseText,
      ephemeral: true,
    });
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  assignRole,
};
