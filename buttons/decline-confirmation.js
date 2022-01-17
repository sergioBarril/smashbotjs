const playerDB = require("../db/player");
const lobbyDB = require("../db/lobby");
const { MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
  data: { name: "decline-confirmation" },
  async execute(interaction) {
    const clickedPlayer = await playerDB.get(interaction.user.id, true);
    const playersInfo = await lobbyDB.rejectConfirmation(
      clickedPlayer.id,
      false
    );

    const otherPlayersInfo = playersInfo.others;

    const row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("accept-afk")
        .setLabel("Sí, busca otra vez")
        .setStyle("SUCCESS"),
      new MessageButton()
        .setCustomId("decline-afk")
        .setLabel("No, me voy")
        .setStyle("DANGER")
    );
    for (info of otherPlayersInfo) {
      const player = await interaction.client.users.fetch(info.discord_id);
      const message = await player.dmChannel.messages.fetch(info.message_id);
      await message.edit({
        content: `Tu rival ha **rechazado** la partida. ¿Quieres volver a buscar partida, o mejor lo dejamos aquí?`,
        components: [row],
      });
    }

    await interaction.update({
      content:
        `Has rechazado la partida, y te he sacado de todas las búsquedas de partida.\n` +
        `¡Espero volver a verte pronto!`,
      components: [],
    });
  },
};
