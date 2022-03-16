const smashCharacters = require("../params/smashCharacters.json");
const spanishRegions = require("../params/spanishRegions.json");

const { normalizeCharacter, normalizeRegion } = require("./normalize");

const rolesAPI = require("../api/roles");

const YUZU_EMOJI = "<:yuzu:945850935035441202>";
const PARSEC_EMOJI = "<:parsec:945853565405114510>";

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    GUILD_NOT_FOUND: `__**ERROR**__: No se ha encontrado el servidor.`,
    PLAYER_NOT_FOUND: `__**ERROR**__: No se ha encontrado al jugador.`,
    DB_ERR_NO_CHAR: `__**ERROR**__: No se ha encontrado al personaje en la base de datos.`,
    DB_ERR_NO_rEGION: `__**ERROR**__: No se ha encontrado la región en la base de datos.`,
  };

  const { name, args } = exception;

  const listFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });

  // Get message
  let response = EXCEPTION_MESSAGES[name];
  if (!response)
    switch (name) {
      case "CHAR_NAME_NOT_FOUND": {
        response = `No he encontrado el personaje _${args.name}_. ¿Lo has escrito bien?`;
        break;
      }
      case "REGION_NAME_NOT_FOUND": {
        response = `No he encontrado la región _${args.name}_. ¿Lo has escrito bien?`;
        break;
      }
      case "TOO_MANY_MAINS":
      case "TOO_MANY_SECONDS":
      case "TOO_MANY_POCKETS":
        const listString = listFormatter.format(
          args.current.map((char) => `**${char.name}** ${smashCharacters[char.name].emoji}`)
        );

        if (name === "TOO_MANY_MAINS")
          response = `El máximo de mains son 2. Ya tienes 2 mains asignados: ${listString}.`;
        else if (name === "TOO_MANY_SECONDS")
          response = `El máximo de seconds son 3. Ya tienes 3 seconds asignados: ${listString}.`;
        else response = `El máximo de pockets son 5. Ya tienes 5 pockets asignados: ${listString}.`;
        break;
      case "TOO_MANY_REGIONS": {
        const listString = listFormatter.format(
          args.current.map((region) => `**${region.name}** ${spanishRegions[region.name].emoji}`)
        );

        response = `El máximo de regiones son 2. Ya tienes 2 regiones asignadas: ${listString}`;
        break;
      }
    }

  if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

const assignCharacter = async (interaction, name, type) => {
  const key = normalizeCharacter(name);
  if (!key) throw { name: "CHAR_NAME_NOT_FOUND", args: { name } };

  const player = interaction.user;
  const guild = interaction.guild;

  const { roleId: charRoleId, action } = await rolesAPI.assignCharacter(
    player.id,
    key,
    guild.id,
    type
  );

  // Manage discord role
  const role = await guild.roles.fetch(charRoleId);
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

const assignRegion = async (interaction, name) => {
  const key = normalizeRegion(name);
  if (!key) throw { name: "REGION_NAME_NOT_FOUND", args: { name } };

  const player = interaction.user;
  const guild = interaction.guild;

  const { roleId, action } = await rolesAPI.assignRegion(player.id, key, guild.id);

  const role = await guild.roles.fetch(roleId);
  const member = interaction.member;

  if (action === "REMOVE") await member.roles.remove(role);
  else await member.roles.add(role);

  // Response
  let emoji = spanishRegions[key].emoji;

  if (action === "CREATE") return `Te he asignado la región **${key}** ${emoji}.`;
  else return `Ya no estás en la región de **${key}** ${emoji}.`;
};

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

const assignRole = async (interaction, name, type) => {
  let responseText;

  try {
    if (["MAIN", "SECOND", "POCKET"].includes(type))
      responseText = await assignCharacter(interaction, name, type);
    else if (type === "REGION") responseText = await assignRegion(interaction, name);
    else if (type === "YUZU") responseText = await assignYuzu(interaction, name);
    // else if (type === "WIFI")
    // responseText = await assignWifi(interaction, name)

    return await interaction.reply({
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
