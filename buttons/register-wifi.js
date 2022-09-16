const guildAPI = require("../api/guild");
const playerAPI = require("../api/player");
const { NotFoundError } = require("../errors/notFound");

const execute = async (interaction) => {
  const player = interaction.member;
  const guild = interaction.guild;

  const wifiTier = await guildAPI.getWifiTier(guild.id);
  if (!wifiTier) throw new NotFoundError("WifiTier", "Este servidor no tiene rol de Wifi.");

  const noCableRoleId = await guildAPI.getNoCableRole(guild.id);
  const noCableRole = await guild.roles.fetch(noCableRoleId);

  const wifiRole = await guild.roles.fetch(wifiTier.roleId);

  await player.roles.add(wifiRole);
  await player.roles.add(noCableRole);

  const wifiChannel = await guild.channels.fetch(wifiTier.channelId);
  const { matchmakingChannelId } = await guildAPI.getGuild(guild.id);
  const matchmakingChannel = await guild.channels.fetch(matchmakingChannelId);

  const messageText =
    `Vale, te he asignado el rol de **Wifi**.\n` +
    `Como no tienes cable, no tendrás acceso al matchmaking con Tiers, pero podrás buscar partida` +
    ` con otros jugando en Wifi.\n\n` +
    `Como canales de interés tienes:\n\t- ${matchmakingChannel} donde podrás buscar partida dándole al botón de Wifi\n\t` +
    `- ${wifiChannel} donde podrás hablar con el resto de gente sin cable.\n\n` +
    `Eso es todo: si tienes alguna duda más, ¡pregunta sin miedo!`;

  const message = interaction.message;

  message.components[0].components.forEach((button) => button.setDisabled(true));
  await interaction.message.edit({
    content: message.content,
    components: message.components,
  });
  await interaction.reply(messageText);
};

module.exports = {
  data: { name: "register-wifi" },
  execute,
};
