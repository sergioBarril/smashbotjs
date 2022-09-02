const setAPI = require("../api/gameSet");
const { Stage } = require("../models/stage");

const {
  setupGameWinner,
  stageButtons,
  stageFinalButtons,
  stageFinalText,
  stageText,
  setupCharacter,
} = require("../utils/discordGameset");

/**
 *
 * @param {Interaction} interaction DiscordJS Interaction
 * @param {int} gameNum Number of the game
 * @param {Stage[]} stages Stages
 * @param {Stage} pickedStage Picked stage
 * @returns
 */
const endStageStep = async (interaction, gameNum, stages, pickedStage) => {
  const banMessageComponents = stageFinalButtons(stages, pickedStage);
  const banMessageText = stageFinalText(gameNum, pickedStage);

  await interaction.message.edit({
    content: banMessageText,
    components: banMessageComponents,
  });

  await interaction.deferUpdate();
  if (gameNum == 1) return await setupGameWinner(interaction, gameNum);
  else {
    const lastWinner = await setAPI.getGameWinner(gameNum - 1);
    const player = await interaction.guild.members.fetch(lastWinner.discordId);
    return await setupCharacter(interaction.channel, player, interaction.guild.id);
  }
};

const nextStep = async (interaction, gameNum, nextPlayerId, stages, bannedStages, isBan) => {
  const nextPlayer = await interaction.guild.members.fetch(nextPlayerId);
  const stageMessageText = stageText(nextPlayer, gameNum, bannedStages.length, isBan);
  const stageMessageComponents = stageButtons(nextPlayer.id, gameNum, stages, bannedStages, isBan);

  await interaction.message.edit({
    content: stageMessageText,
    components: stageMessageComponents,
  });

  await interaction.deferUpdate();
};

const execute = async (interaction) => {
  const customId = interaction.customId.split("-");
  const playerId = customId[2];
  const gameNum = Number(customId[3]);

  if (interaction.user.id != playerId) {
    return await interaction.reply({
      content: `¡No te toca banear aún! Espera a que banee tu rival, y luego le das tú.`,
      ephemeral: true,
    });
  }
  const stageName = interaction.component.label;

  const stages = await setAPI.getStages(gameNum);
  const banResponse = await setAPI.banStage(playerId, gameNum, stageName);
  const { nextStriker, nextPicker, starter, bannedStages } = banResponse;
  const isBan = nextPicker == null;

  if (nextStriker === null && starter)
    return await endStageStep(interaction, gameNum, stages, starter);

  const nextPlayer = nextStriker ?? nextPicker;
  return await nextStep(interaction, gameNum, nextPlayer.discordId, stages, bannedStages, isBan);
};

module.exports = {
  data: { name: "ban-stage" },
  execute,
};
