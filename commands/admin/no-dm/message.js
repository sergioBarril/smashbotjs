const { MessageActionRow, MessageButton } = require("discord.js");

const noDmMessage =
  `El bot está pensado para poder enviar DMs a los jugadores. Si veis estos canales quiere decir que el bot ha intentado enviaros un DM, pero no lo ha logrado.\n` +
  `Lo más probable es que sea porque tienes los DM cerrados. Si queréis podéis seguir usando este canal como si fueran vuestros DMs, pero os recomiendo encarecidamente` +
  ` que abráis vuestros DM y uséis el bot como estaba pensado desde un inicio.\n` +
  `Una vez hayáis abierto hecho vuestros DM accesibles al bot, dadle a este botón para dejar de ver estos canales exclusivos para la gente que tiene los DM cerrados.`;

const toggleButton = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId("no-dm-role")
    .setLabel('Quitar el rol "No DM"')
    .setStyle("SUCCESS")
    .setEmoji("📮")
);

const message = async (interaction) => {
  const channel = interaction.channel;

  await channel.send({
    content: noDmMessage,
    components: [toggleButton],
  });

  await interaction.reply({
    content: "Mensaje enviado!",
    ephemeral: true,
  });
};

module.exports = { message };
