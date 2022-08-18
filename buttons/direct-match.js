const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");
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

/**
 * Actions to do after finding a match
 * This includes:
 *  - sending the confirmation DMs
 *  - editing existing #tier-X messages
 * @param {*} interaction
 * @param {Array<Player>} players
 */
const matched = async (interaction, players) => {
  const guild = interaction.guild;
  await discordMatchingUtils.matched(guild, players);

  await interaction.editReply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
};

const execute = async (interaction) => {
  const playerId = interaction.user.id;
  const messageId = interaction.message.id;

  await interaction.deferReply({ ephemeral: true });
  try {
    const searchResult = await lobbyAPI.directMatch(playerId, messageId);
    await matched(interaction, searchResult.players);
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data: { name: "direct-match" },
  execute,
};
