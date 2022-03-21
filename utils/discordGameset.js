const setAPI = require("../api/gameSet");
const stageEmojis = require("../params/stageEmojis.json");

const { MessageActionRow, MessageButton } = require("discord.js");

const banButtons = (stages, gameNum, strikerId) => {
  const rows = [];
  let i = 0;
  let row;

  for (stage of stages) {
    const emoji = stageEmojis[stage.name];
    if (i % 5 === 0) {
      if (row) rows.push(row);
      row = new MessageActionRow();
    }
    row.addComponents(
      new MessageButton()
        .setCustomId(`ban-stage-${strikerId}-${gameNum}-${stage.id}`)
        .setLabel(stage.name)
        .setStyle("PRIMARY")
        .setEmoji(emoji)
    );
    i++;
  }
  rows.push(row);

  return rows;
};

const setupBans = async (interaction, gameNum) => {
  const stages = await setAPI.getStages(gameNum);

  const { striker } = await setAPI.getStriker(interaction.channel.id);

  const player = await interaction.guild.members.fetch(striker.discord_id);

  const firstBanText = `${player} te toca banear un escenario. Pulsa el botón del escenario que quieras __**BANEAR**__`;
  await interaction.channel.send({
    content: firstBanText,
    components: banButtons(stages, gameNum, player.id),
  });
};

module.exports = { setupBans };
