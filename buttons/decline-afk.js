const winston = require("winston");
const { removeAfkLobby } = require("../api/lobby");

module.exports = {
  data: { name: "decline-afk" },
  async execute(interaction) {
    await interaction.deferUpdate();
    await removeAfkLobby(interaction.user.id);

    winston.info(`${interaction.user.username} ha rechazado salir del AFK buscando.`);

    if (interaction.inGuild()) {
      await interaction.deleteReply();
    } else
      await interaction.editReply({
        content: `De acuerdo **${interaction.user.username}**, ya no estás buscando partida.`,
        components: [],
      });
  },
};
