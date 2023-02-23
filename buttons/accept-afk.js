const winston = require("winston");
const lobbyAPI = require("../api/lobby");
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
      winston.info(`${player.username} ha dejado de estar AFK y se ha puesto a buscar`);
      await discordMatchingUtils.notMatched(player.id, guild, null, searchedRanked, false);

      if (interaction.inGuild()) await interaction.deleteReply();
      else
        await interaction.editReply({
          content: `De acuerdo **${interaction.user.username}**, estás buscando partida de nuevo.`,
          components: [],
        });
    }
  },
};
