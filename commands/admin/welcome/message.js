const { MessageActionRow, MessageButton } = require("discord.js");

const welcomeMessage =
  `¡Se os da la bienvenida al servidor español de matchmaking de **Super Smash Bros. Ultimate**!\n` +
  `Aquí podréis jugar contra gente de vuestro nivel, tanto si tenéis mucha experiencia como si acabáis de empezar a jugar.\n` +
  `No lo penséis más, y dadle al botón para que se os asigne una Tier, y así registraros en el servidor.`;

const registerButton = new MessageActionRow().addComponents(
  new MessageButton().setCustomId("register").setLabel("Empezar").setStyle("SUCCESS").setEmoji("✉️")
);

const message = async (interaction) => {
  const channel = interaction.channel;

  await channel.send({
    content: welcomeMessage,
    components: [registerButton],
  });

  await interaction.reply({
    content: "Mensaje enviado!",
    ephemeral: true,
  });
};

module.exports = { message };
