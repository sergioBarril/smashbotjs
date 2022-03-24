const { SlashCommandBuilder } = require("@discordjs/builders");
const { cancelLobby } = require("../utils/discordCancel");

const data = new SlashCommandBuilder()
  .setName("close-lobby")
  .setDescription("Cierra el lobby en el que estás jugando.");

const execute = async (interaction) => await cancelLobby(interaction);

module.exports = {
  data: data,
  execute,
};
