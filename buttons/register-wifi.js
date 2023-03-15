const winston = require("winston");
const guildAPI = require("../api/guild");
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
  const { matchmakingChannelId, panelistChannelId } = await guildAPI.getGuild(guild.id);
  const matchmakingChannel = await guild.channels.fetch(matchmakingChannelId);

  await guild.commands.fetch();
  const mainCommand = guild.commands.cache.find((command) => command.name === "main");
  const secondCommand = guild.commands.cache.find((command) => command.name === "second");
  const pocketCommand = guild.commands.cache.find((command) => command.name === "pocket");

  const regionCommand = guild.commands.cache.find((command) => command.name === "region");
  const profileCommand = guild.commands.cache.find((command) => command.name === "profile");

  const profileText =
    `Además, ¿qué tal si vas completando tu perfil?\n` +
    `\t- Usa el comando </main:${mainCommand.id}> para asignarte tus personajes principales (máximo 2). Por ejemplo, /main mario.\n` +
    `\t- Usa el comando </second:${secondCommand.id}> para asignarte tus personajes secundarios (máximo 3). Por ejemplo, /second lucina.\n` +
    `\t- Usa el comando </pocket:${pocketCommand.id}> para asignarte hasta 5 personajes más. Por ejemplo, /pocket cloud.\n\n` +
    `\t- Usa el comando </region:${regionCommand.id}> para asignarte tu región (máximo 2). Por ejemplo, /region madrid\n\n` +
    `No hace falta que lo llenéis todo, lo normal sería que jugarais 1, 2 o 3 personajes como mucho.\n` +
    `Usa el comando </profile:${profileCommand.id}> para ver el perfil con los datos que hayas ido rellenando.\n\n`;

  const messageText =
    `Vale, te he asignado el rol de **Wifi**.\n` +
    `Como no tienes cable, no tendrás acceso al matchmaking con Tiers, pero podrás buscar partida` +
    ` con otros jugando en Wifi.\n\n` +
    `Como canales de interés tienes:\n\t- ${matchmakingChannel} donde podrás buscar partida dándole al botón de Wifi\n\t` +
    `- ${wifiChannel} donde podrás hablar con el resto de gente sin cable.\n\n${profileText}` +
    `Eso es todo: si tienes alguna duda más, ¡pregunta sin miedo!`;

  const message = interaction.message;

  // Edit channel name
  await interaction.channel.setName("registro-completado");

  // Send message in #panelists
  const panelistChannel = await guild.channels.fetch(panelistChannelId);
  await panelistChannel.send(`**${player.displayName}** se ha autoasignado la tier Wifi`);

  winston.info(`**${player.displayName}** se ha autoasignado la tier Wifi`);

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
