const { SlashCommandBuilder } = require("@discordjs/builders");
const winston = require("winston");
const setAPI = require("../api/gameSet");
const messageAPI = require("../api/message");
const { setupNextGame } = require("../utils/discordGameset");

const data = new SlashCommandBuilder()
  .setName("surrender")
  .setDescription("Admite la derrota en el set en curso");

const execute = async (interaction) => {
  const player = interaction.user;
  const channel = interaction.channel;

  await interaction.deferReply();
  await setAPI.surrender(player.id, channel.id);
  await messageAPI.deleteCharacterMessages(player.id);
  winston.info(`${player.username} se ha rendido.`);
  await setupNextGame(interaction);
};

module.exports = {
  data,
  execute,
};
