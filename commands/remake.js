const { SlashCommandBuilder } = require("@discordjs/builders");
const winston = require("winston");
const setAPI = require("../api/gameSet");
const messageAPI = require("../api/message");

const { setupNextGame } = require("../utils/discordGameset");

const data = new SlashCommandBuilder()
  .setName("remake")
  .setDescription("Vuelve a empezar el game en curso. Usadlo solo si se queda bloqueado el bot.");

const execute = async (interaction) => {
  const channel = interaction.channel;

  await setAPI.removeCurrentGame(channel.id);
  await messageAPI.deleteCharacterMessages(interaction.user.id);
  await interaction.reply("¡Corten! ¡Repetimos!");
  winston.info(`${interaction.user.username} ha hecho /remake`);
  await setupNextGame(interaction);
};

module.exports = {
  data,
  execute,
};
