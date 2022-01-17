const lobbyDB = require("../db/lobby");
const tierDB = require("../db/tier");

module.exports = {
  data: { name: "cancel-friendlies" },
  async execute(interaction) {
    const lobby = await lobbyDB.getByPlayer(interaction.user.id, true);
    const tier = await tierDB.getByMessage(interaction.message.id);

    const tierRole =
      tier && (await interaction.guild.roles.fetch(tier.discord_id));

    const hasTier = await lobbyDB.hasTier(lobby?.id, tier?.id);

    if (!lobby)
      return await interaction.reply({
        content: `No estabas buscando partida...`,
        ephemeral: true,
      });

    if (lobby.status !== "SEARCHING") {
      let response = "";
      if (lobby.status === "CONFIRMATION" || lobby.status === "WAITING")
        response =
          "Ya has encontrado partida. Acéptala (o espera a que tu rival la acepte)";
      else if (lobby.status === "PLAYING")
        response = "Ya estás jugando. Cierra la arena desde allí.";
      return await interaction.reply({
        content: response,
        ephemeral: true,
      });
    }

    if (!tier)
      return await interaction.reply({
        content: `No se ha encontrado la tier asociada a este botón.`,
        ephemeral: true,
      });

    if (!hasTier)
      return await interaction.reply({
        content: `No estabas buscando partida en ${tierRole}...`,
        ephemeral: true,
      });

    await lobbyDB.removeTier(lobby.id, tier.id);
    await interaction.reply({
      content: `Hecho, ya no estás buscando partida en ${tierRole}`,
      ephemeral: true,
    });
  },
};
