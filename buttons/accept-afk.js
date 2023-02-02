const lobbyAPI = require("../api/lobby");
const { CustomError } = require("../errors/customError");
const discordMatchingUtils = require("../utils/discordMatching");

module.exports = {
  data: { name: "accept-afk" },
  async execute(interaction) {
    const player = interaction.user;
    await interaction.deferUpdate();

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
  },
};
