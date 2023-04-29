const { getRankedCountToday } = require("../api/gameSet");
const { CustomError } = require("../errors/customError");
const { cancelLobby, avoidRematchMessage } = require("../utils/discordCancel");

const execute = async (interaction) => {
  await interaction.deferReply();
  if (!interaction.guild) {
    throw new CustomError("Este comando tienes que usarlo en el lobby.");
  }
  const [playerDiscordId, playerDiscordId2] = await cancelLobby(
    interaction.user,
    interaction.guild
  );
  await interaction.editReply({
    content: "GGs, ¡gracias por jugar! _(Esta arena se destruirá en 10 minutos...)_",
  });

  const components = interaction.message.components;
  components[0].components.forEach((button) => button.setDisabled(true));
  await interaction.message.edit({ components });

  // Avoid rematch buttons
  const count = await getRankedCountToday(playerDiscordId, playerDiscordId2);
  if (count === 1) {
    await avoidRematchMessage(interaction, playerDiscordId, playerDiscordId2);
  }
};

module.exports = {
  data: { name: "close-lobby" },
  execute,
};
