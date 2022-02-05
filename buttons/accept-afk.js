const lobbyAPI = require("../api/lobby");
const discordMatchingUtils = require("../utils/discordMatching");

module.exports = {
  data: { name: "accept-afk" },
  async execute(interaction) {
    const player = interaction.user;
    const { rival: rivalPlayer, guild: guildId } = await lobbyAPI.unAFK(
      player.id
    );

    const guild = await interaction.client.guilds.fetch(guildId);

    if (rivalPlayer) {
      const playerIdList = [player.id, rivalPlayer.discord_id];
      await discordMatchingUtils.matched(guild, playerIdList);
    } else {
      await discordMatchingUtils.notMatched(player.id, guild);
    }

    await interaction.update({
      content: `De acuerdo **${interaction.user.username}**, estás buscando partida de nuevo.`,
      components: [],
    });
  },
};
