const { MessageButton, MessageActionRow } = require("discord.js");
const winston = require("winston");
const guildAPI = require("../api/guild");
const playerAPI = require("../api/player");
const tierAPI = require("../api/tier");
const { NotFoundError } = require("../errors/notFound");

const execute = async (interaction) => {
  const player = interaction.member;
  const guild = interaction.guild;

  const wifiTier = await guildAPI.getWifiTier(guild.id);
  if (!wifiTier) throw new NotFoundError("WifiTier", "Este servidor no tiene rol de Wifi.");

  const { weighted } = await tierAPI.getTiers(guild.id);
  const tierButtons = weighted.map((tier) =>
    new MessageButton()
      .setCustomId(`register-tier-${tier.roleId}-${player.id}`)
      .setLabel(`Tier ${tier.weight}`)
      .setStyle("SECONDARY")
  );
  const wifiButton = new MessageButton()
    .setCustomId(`register-tier-wifi-${player.id}`)
    .setLabel(`No tiene cable`)
    .setStyle("DANGER");

  await guild.commands.fetch();
  const mainCommand = guild.commands.cache.find((command) => command.name === "main");
  const secondCommand = guild.commands.cache.find((command) => command.name === "second");
  const pocketCommand = guild.commands.cache.find((command) => command.name === "pocket");

  const regionCommand = guild.commands.cache.find((command) => command.name === "region");

  const messageText =
    `Perfecto. Ahora solo queda esperar a que **un panelista** venga a darte los roles.\n` +
    `Mientras tanto... ¿qué tal si vas completando tu perfil?\n` +
    `\t- Usa el comando </main:${mainCommand.id}> para asignarte tus personajes principales (máximo 2). Por ejemplo, /main mario.\n` +
    `\t- Usa el comando </second:${secondCommand.id}> para asignarte tus personajes secundarios (máximo 3). Por ejemplo, /second lucina.\n` +
    `\t- Usa el comando </pocket:${pocketCommand.id}> para asignarte hasta 5 personajes más. Por ejemplo, /pocket cloud.\n\n` +
    `\t- Usa el comando </region:${regionCommand.id}> para asignarte tu región (máximo 2). Por ejemplo, /region madrid\n\n` +
    `No hace falta que lo respondáis todo, lo normal sería que jugarais 1, 2 o 3 personajes.\n` +
    `_(Ignora los botones que verás a continuación, los usará el panelista para asignarte más fácilmente la tier)_`;

  const message = interaction.message;

  message.components[0].components.forEach((button) => button.setDisabled(true));
  await interaction.message.edit({
    content: message.content,
    components: message.components,
  });

  await interaction.reply({
    content: messageText,
    components: [new MessageActionRow().addComponents(...tierButtons, wifiButton)],
  });

  const guildInfo = await guildAPI.getGuild(guild.id);
  if (!guildInfo) throw new NotFoundError("Guild");

  // Alert panelists
  if (guildInfo.panelistRoleId && guildInfo.panelistChannelId) {
    const panelistChannel = await guild.channels.fetch(guildInfo.panelistChannelId);
    const panelistRole = await guild.roles.fetch(guildInfo.panelistRoleId);

    const adminMessageText = `:information_source: Atención ${panelistRole}, ¡${player.displayName} ha terminado con el registro en ${interaction.channel}!`;
    await panelistChannel.send(adminMessageText);
  }

  winston.info(`${player.displayName} ha respondido el formulario de registro.`);
};

module.exports = {
  data: { name: "register-cable-done" },
  execute,
};
