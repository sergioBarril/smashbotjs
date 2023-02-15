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
};

module.exports = {
  data: data,
  execute,
};
