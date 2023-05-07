const { SlashCommandBuilder } = require("@discordjs/builders");
const { CustomError } = require("../errors/customError");
const { cancelLobby } = require("../utils/discordCancel");

const data = new SlashCommandBuilder()
  .setName("close-lobby")
  .setDescription("Cierra el lobby en el que estás jugando.");

const execute = async (interaction) => {
  await interaction.deferReply();
  if (!interaction.guild) {
    throw new CustomError("Este comando tienes que usarlo en el lobby.");
  }
  await cancelLobby(interaction.user, interaction.guild);
  await interaction.editReply({
    content: "GGs, ¡gracias por jugar!",
  });

  // Avoid rematch buttons
  const count = await getRankedCountToday(playerDiscordId, playerDiscordId2);
  if (count === 1) {
    await avoidRematchMessage(interaction, playerDiscordId, playerDiscordId2);
  }
};

module.exports = {
  data: data,
  execute,
};
