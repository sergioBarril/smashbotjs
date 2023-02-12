const winston = require("winston");
const setAPI = require("../api/gameSet");

const { stageFinalButtons, stageFinalText, setupGameWinner } = require("../utils/discordGameset");

const endStageStep = async (interaction, gameNum, stages, pickedStage) => {
  const stageMessageComponents = stageFinalButtons(stages, pickedStage);
  const stageMessageText = stageFinalText(gameNum, pickedStage);

  await interaction.message.edit({
    content: stageMessageText,
    components: stageMessageComponents,
  });

  await interaction.deferUpdate();
  return await setupGameWinner(interaction, gameNum);
};

const execute = async (interaction) => {
  const customId = interaction.customId.split("-");
  const playerId = customId[2];
  const gameNum = Number(customId[3]);

  if (interaction.user.id != playerId) {
    return await interaction.reply({
      content: `¡No te toca pickear! Ya has baneado los stages, ahora espera a que tu rival elija.`,
      ephemeral: true,
    });
  }
  const stageName = interaction.component.label;

  const stages = await setAPI.getStages(gameNum);
  const stage = await setAPI.pickStage(playerId, gameNum, stageName);

  winston.info(`${interaction.user.username} ha pickeado ${stageName}`);

  return await endStageStep(interaction, gameNum, stages, stage);
};

module.exports = {
  data: { name: "pick-stage" },
  execute,
};
