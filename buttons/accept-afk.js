const lobbyAPI = require("../api/lobby");
const { CustomError } = require("../errors/customError");
const discordMatchingUtils = require("../utils/discordMatching");

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
  data: { name: "accept-afk" },
  async execute(interaction) {
    const player = interaction.user;
    await interaction.deferUpdate();
    try {
      const {
        matched,
        players,
        guild: guildModel,
        searchedRanked,
        foundRanked,
      } = await lobbyAPI.searchAgainAfkLobby(player.id);

      const guild = await interaction.client.guilds.fetch(guildModel.discordId);

      if (matched) {
        await interaction.deleteReply();
        await discordMatchingUtils.matched(guild, players, foundRanked);
      } else {
        await discordMatchingUtils.notMatched(player.id, guild, null, searchedRanked, false);
        await interaction.editReply({
          content: `De acuerdo **${interaction.user.username}**, estás buscando partida de nuevo.`,
          components: [],
        });
      }
    } catch (ex) {
      await exceptionHandler(interaction, ex);
    }
  },
};
