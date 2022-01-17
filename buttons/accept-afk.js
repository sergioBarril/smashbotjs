const lobbyDB = require("../db/lobby");

// PLACEHOLDER
module.exports = {
  data: { name: "accept-afk" },
  async execute(interaction) {
    await lobbyDB.removeByPlayer(interaction.user.id, true);

    await interaction.update({
      content: `De acuerdo **${interaction.user.username}**, ya no estás buscando partida.`,
      components: [],
    });
  },
};
