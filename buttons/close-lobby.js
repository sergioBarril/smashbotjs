const { CustomError } = require("../errors/customError");
const { cancelLobby } = require("../utils/discordCancel");

const execute = async (interaction) => {
  await interaction.deferReply();
  if (!interaction.guild) {
    throw new CustomError("Este comando tienes que usarlo en el lobby.");
  }
  await cancelLobby(interaction.user, interaction.guild);
  await interaction.editReply({
    content: "GGs, ¡gracias por jugar! _(Esta arena se destruirá en 10 minutos...)_",
  });

  const components = interaction.message.components;
  components[0].components.forEach((button) => button.setDisabled(true));
  await interaction.message.edit({ components });
};

module.exports = {
  data: { name: "close-lobby" },
  execute,
};
