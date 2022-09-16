const { Guild } = require("discord.js");
const rolesAPI = require("../api/roles");
const ratingAPI = require("../api/rating");
const tierAPI = require("../api/tier");
const { getWifiTier, getGuild } = require("../api/guild");

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

/**
 * Remove old roles, add new tier roles and send a message to #panelists
 *
 * @param {string} tierRoleId DiscordID of the tier to add
 * @param {string} playerId DiscordID of the player receiving the tier
 * @param {string} panelistId DiscordID of the panelist
 * @param {Guild} guild DiscordJS guild object
 */
async function assignTier(tierRoleId, playerId, panelistId, guild) {
  let tierRole;
  const isWifi = tierRoleId == "wifi";

  const member = await guild.members.fetch(playerId);

  const oldTier = await ratingAPI.getPlayerTier(playerId, guild.id, true);
  const guildInfo = await getGuild(guild.id);

  const cableRole = await guild.roles.fetch(guildInfo.cableRoleId);
  const noCableRole = await guild.roles.fetch(guildInfo.noCableRoleId);

  // Remove old roles
  if (oldTier) {
    const oldRole = await guild.roles.fetch(oldTier.roleId);
    const oldRankedRole = await guild.roles.fetch(oldTier.rankedRoleId);
    await member.roles.remove(oldRole);
    await member.roles.remove(oldRankedRole);
  }

  // Add wifi roles
  if (isWifi) {
    const wifiTier = await getWifiTier(guild.id);
    tierRole = await guild.roles.fetch(wifiTier.roleId);
    // Cable roles
    await ratingAPI.setPlayerTier(playerId, guild.id, null);
    await member.roles.remove(cableRole);
    await member.roles.add(noCableRole);
  } else {
    // Cable roles
    await ratingAPI.setPlayerTier(playerId, guild.id, tierRoleId);
    tierRole = await guild.roles.fetch(tierRoleId);

    const tierInfo = await tierAPI.getTier(guild.id, tierRoleId);
    const rankedRole = await guild.roles.fetch(tierInfo.rankedRoleId);

    await member.roles.add(rankedRole);
    await member.roles.add(cableRole);
    await member.roles.remove(noCableRole);
  }

  await member.roles.add(tierRole);

  // Send message in #panelists
  const panelistChannel = await guild.channels.fetch(guildInfo.panelistChannelId);
  const panelistMember = await guild.members.fetch(panelistId);
  await panelistChannel.send(
    `**${panelistMember.displayName}** le ha asignado la tier **${tierRole.name}** a **${member.displayName}**`
  );

  return tierRole;
}

module.exports = {
  assignTier,
};
