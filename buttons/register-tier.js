const { getGuild, getWifiTier } = require("../api/guild");
const { CustomError } = require("../errors/customError");
const { assignTier } = require("../utils/discordTiers");

function getCableMessage(tierRole, matchmakingChannel) {
  return (
    `Vale, se te ha asignado el rol de ${tierRole}.\n` +
    `Como tienes cable, tendrás acceso al matchmaking con Tiers y al sistema de rankeds\n\n` +
    `Como canal de interés tienes ${matchmakingChannel}, donde podrás buscar partida dándole al botón de las tiers.\n` +
    `Puedes buscar partida en ${tierRole} y tiers más bajas, y también puedes buscar partidas clasificatorias para ascender a siguientes tiers.\n` +
    `Eso es todo: paséate por el servidor y si tienes alguna duda más, ¡pregunta sin miedo!`
  );
}

function getNoCableMessage(matchmakingChannel, wifiChannel) {
  return (
    `Vale, se te ha asignado el rol de **Wifi**.\n` +
    `Como no tienes cable, no tendrás acceso al matchmaking con Tiers, pero podrás buscar partida` +
    ` con otros jugando en Wifi.\n\n` +
    `Como canales de interés tienes:\n\t- ${matchmakingChannel} donde podrás buscar partida dándole al botón de Wifi\n\t` +
    `- ${wifiChannel} donde podrás hablar con el resto de gente sin cable.\n\n` +
    `Eso es todo: paséate por el servidor y si tienes alguna duda más, ¡pregunta sin miedo!`
  );
}

const execute = async (interaction) => {
  const guild = interaction.guild;
  const panelist = interaction.member;

  // Check if user is panelist
  const guildInfo = await getGuild(guild.id);
  const isPanelist = panelist.roles.cache.some((role) => role.id == guildInfo.panelistRoleId);

  if (!isPanelist)
    throw new CustomError("¡No eres panelista! Espera un momento y un admin te asignará la tier.");

  await interaction.deferReply();

  const customId = interaction.customId.split("-");
  const playerId = customId[3];
  const roleId = customId[2];

  const tierRole = await assignTier(roleId, playerId, panelist.id, guild);

  // Channel message
  const isWifi = roleId == "wifi";

  let messageText;

  const matchmakingChannel = await guild.channels.fetch(guildInfo.matchmakingChannelId);
  if (isWifi) {
    const wifiTier = await getWifiTier(guild.id);
    const wifiChannel = await guild.channels.fetch(wifiTier.channelId);
    messageText = getNoCableMessage(matchmakingChannel, wifiChannel);
  } else {
    messageText = getCableMessage(tierRole, matchmakingChannel);
  }
  await interaction.editReply(messageText);

  // Edit channel name
  await interaction.channel.setName("registro-completado");
  const components = interaction.message.components;
  components[0].components.forEach((button) => button.setDisabled(true));
  await interaction.message.edit({ components });
};

module.exports = {
  data: { name: "register-tier" },
  execute,
};
