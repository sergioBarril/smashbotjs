const guildAPI = require("../api/guild");
const { NotFoundError } = require("../errors/notFound");

const execute = async (interaction) => {
  const player = interaction.member;
  const guild = interaction.guild;

  const guildInfo = await guildAPI.getGuild(guild.id);
  if (!guildInfo) throw new NotFoundError("Guild");

  if (!guildInfo.panelistChannelId || !guildInfo.panelistRoleId)
    throw new NotFoundError("PanelistInfo");

  const panelistChannel = await guild.channels.fetch(guildInfo.panelistChannelId);
  const panelistRole = await guild.roles.fetch(guildInfo.panelistRoleId);

  const messageText =
    `¡Que no cunda el pánico! Ya he avisado a los admins para que vengan a ayudarte.\n` +
    `Deja tu pregunta en este chat y te la responderán cuando lleguen.`;
  const adminMessageText = `:information_source: Atención ${panelistRole}, ¡${player.displayName} necesita ayuda con el registro en ${interaction.channel}!`;

  const message = interaction.message;

  // Disable only this button
  message.components[0].components.forEach((button) =>
    button.setDisabled(button.customId == interaction.component.customId)
  );
  await interaction.message.edit({
    content: message.content,
    components: message.components,
  });

  await panelistChannel.send(adminMessageText);
  await interaction.reply(messageText);
};

module.exports = {
  data: { name: "register-cable-help" },
  execute,
};
