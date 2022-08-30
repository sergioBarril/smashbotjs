const { pickCharacter } = require("../utils/discordGameset");

const execute = async (interaction) => {
  const customId = interaction.customId.split("-");
  const playerId = customId[2];
  const gameNum = Number(customId[3]);
  const charName = interaction.component.label;

  if (interaction.user.id != playerId) {
    return await interaction.reply({
      content: `¡Estos son los botones del otro jugador! Tú ya tienes los tuyos...`,
      ephemeral: true,
    });
  }

  await pickCharacter(interaction, playerId, charName);
};

module.exports = {
  data: { name: "play-character" },
  execute,
};
