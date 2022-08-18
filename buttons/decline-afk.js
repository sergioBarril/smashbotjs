const { removeAfkLobby } = require("../api/lobby");
const { CustomError } = require("../errors/customError");

const exceptionHandler = async (interaction, exception) => {
  let message = exception.message;

  if (!(exception instanceof CustomError)) {
    message = "Ha habido un error inesperado. Habla con un admin para que mire los logs.";
    console.error(exception, exception.stack);
  }

  await interaction.followUp({
    content: message,
    ephemeral: true,
  });
};

module.exports = {
  data: { name: "decline-afk" },
  async execute(interaction) {
    await interaction.deferUpdate();
    try {
      await removeAfkLobby(interaction.user.id);

      await interaction.editReply({
        content: `De acuerdo **${interaction.user.username}**, ya no estás buscando partida.`,
        components: [],
      });
    } catch (e) {
      await exceptionHandler(interaction, e);
    }
  },
};
