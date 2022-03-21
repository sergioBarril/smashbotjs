const setAPI = require("../api/gameSet");

const stageEmojis = require("../params/stageEmojis.json");
const { MessageActionRow, MessageButton } = require("discord.js");

const banText = (nextStriker, gameNum, bannedStages) => {
  if (gameNum == 1) {
    if (bannedStages.length === 1)
      return `${nextStriker}, te toca banear **DOS** escenarios. Pulsa el botón del escenario que quieras __**BANEAR**__. `;
    else
      return `${nextStriker}, te toca banear otro escenario. Pulsa el botón del escenario que quieras __**BANEAR**__. `;
  }

  // bannedStages.length == 1
  return `${nextStriker}, te toca banear otro escenario. Pulsa el botón del escenario que quieras __**BANEAR**__.`;
};

const banFinalText = (gameNum, starter) => {
  const emoji = stageEmojis[starter.name];
  return `El **Game ${gameNum}** se jugará en **${starter.name}** ${emoji}`;
};

const banButtons = (nextStriker, gameNum, stages, bannedStages) => {
  const rows = [];
  let i = 0;
  let row;
  const bannedStagesNames = bannedStages.map((stage) => stage.name);

  for (stage of stages) {
    const emoji = stageEmojis[stage.name];
    if (i % 5 === 0) {
      if (row) rows.push(row);
      row = new MessageActionRow();
    }

    const button = new MessageButton()
      .setCustomId(`ban-stage-${nextStriker.id}-${gameNum}-${stage.id}`)
      .setLabel(stage.name)
      .setStyle("PRIMARY")
      .setEmoji(emoji);
    if (bannedStagesNames.includes(stage.name)) {
      button.setStyle("SECONDARY");
      button.setDisabled(true);
    }

    row.addComponents(button);
    i++;
  }
  rows.push(row);

  return rows;
};

const banFinalButtons = (stages, starter) => {
  const rows = [];
  let i = 0;
  let row;

  for (stage of stages) {
    const emoji = stageEmojis[stage.name];
    if (i % 5 === 0) {
      if (row) rows.push(row);
      row = new MessageActionRow();
    }

    const button = new MessageButton()
      .setCustomId(`ban-stage-final-${stage.id}`)
      .setLabel(stage.name)
      .setStyle("SECONDARY")
      .setEmoji(emoji)
      .setDisabled(true);
    if (starter.name === stage.name) {
      button.setStyle("SUCCESS");
    }

    row.addComponents(button);
    i++;
  }
  rows.push(row);

  return rows;
};

const execute = async (interaction) => {
  const customId = interaction.customId.split("-");
  const playerId = customId[2];
  const gameNum = customId[3];

  if (interaction.user.id != playerId) {
    return await interaction.reply({
      content: `¡No te toca banear aún! Espera a que banee tu rival, y luego le das tú.`,
      ephemeral: true,
    });
  }
  const stageName = interaction.component.label;

  const stages = await setAPI.getStages(gameNum);
  const banResponse = await setAPI.banStage(playerId, gameNum, stageName);
  const { nextStriker } = banResponse;

  if (nextStriker === null) {
    const { starter } = banResponse;
    const banMessageComponents = banFinalButtons(stages, starter);
    const banMessageText = banFinalText(gameNum, starter);

    await interaction.message.edit({
      content: banMessageText,
      components: banMessageComponents,
    });

    await interaction.reply("Aquí irá la selección de ganador");
  } else {
    const { bannedStages } = banResponse;

    const nextStrikePlayer = await interaction.guild.members.fetch(nextStriker.discord_id);
    const banMessageText = banText(nextStrikePlayer, gameNum, bannedStages);
    const banMessageComponents = banButtons(nextStrikePlayer, gameNum, stages, bannedStages);

    await interaction.message.edit({
      content: banMessageText,
      components: banMessageComponents,
    });

    await interaction.deferUpdate();
  }
};

module.exports = {
  data: { name: "ban-stage" },
  execute,
};
