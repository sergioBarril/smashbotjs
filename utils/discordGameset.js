const setAPI = require("../api/gameSet");
const stageEmojis = require("../params/stageEmojis.json");
const smashCharacters = require("../params/smashCharacters.json");

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

const setupGameWinner = async (interaction, gameNum) => {
  const pc = await setAPI.getPlayersAndCharacters(interaction.user.id);

  const buttons = [];
  let playersTextArr = [];

  for ({ discord_id, character_name } of pc) {
    const player = await interaction.guild.members.fetch(discord_id);
    const emoji = smashCharacters[character_name].emoji;

    playersTextArr.push(`**${player.displayName}** ${emoji}`);

    buttons.push(
      new MessageButton()
        .setCustomId(`game-winner-${discord_id}-${gameNum}`)
        .setLabel(player.displayName)
        .setStyle("SECONDARY")
        .setEmoji(emoji)
    );
  }
  const playersText = new Intl.ListFormat("es").format(playersTextArr);
  await interaction.channel.send({
    content: `¡Que empiece el **Game ${gameNum}** entre ${playersText}! Pulsad el nombre del ganador cuando acabéis.`,
    components: [new MessageActionRow().addComponents(...buttons)],
  });
};

module.exports = { setupBans, setupGameWinner };
