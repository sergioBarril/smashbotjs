const winston = require("winston");
const setAPI = require("../api/gameSet");
const { setupCharacter } = require("../utils/discordGameset");

/**
 *
 * @param {Interaction} interaction DiscordJS Interaction
 * @param {int} gameNum Number of the game
 * @param {Stage[]} stages Stages
 * @param {Stage} pickedStage Picked stage
 * @returns
 */

const execute = async (interaction) => {
  await interaction.deferUpdate();
  await interaction.message.delete();

  const gameNum = Number(interaction.customId.split("-").at(-1));
  await setupCharacter(interaction.channel, interaction.member, gameNum, interaction.guild);

  await setAPI.resetGameWinnerVotes(interaction.channel.id);
};

module.exports = {
  data: { name: "character-set-menu" },
  execute,
};
