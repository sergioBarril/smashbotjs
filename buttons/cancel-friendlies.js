const lobbyAPI = require("../api/lobby");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    LOBBY_NOT_FOUND: "¡No estabas buscando partida!",
    TIER_NOT_FOUND: "__**ERROR**__: No se ha encontrado la tier.",
    ALREADY_PLAYING: "Ya estás jugando. ¡Cierra la arena desde allí!",
    ALREADY_CONFIRMATION:
      "Ya has encontrado partida. Acéptala (o espera a que tu rival la acepte)",
    ERROR_MESSAGE_MODIF: "Ha habido un problema con la gestión de mensajes.",
  };

  const { name, args } = exception;
  let response = EXCEPTION_MESSAGES[name];

  if (!response)
    switch (name) {
      case "NOT_SEARCHING_HERE":
        const { tierId, yuzu } = args;

        if (yuzu) response = `¡No estabas buscando partida en **Yuzu**!`;
        else {
          const tierRole = await interaction.guild.roles.fetch(tierId);
          response = `¡No estabas buscando partida en ${tierRole}!`;
        }
        break;
    }

  if (!response) throw exception;

  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

const successfulReply = async (interaction, isSearching, tierId) => {
  const tierRole = await interaction.guild.roles.fetch(tierId);
  let responseText = `A partir de ahora **no** estás buscando partida en ${tierRole}`;

  if (!isSearching)
    responseText = `Ya no estás buscando partida. ¡Hasta pronto!`;

  return await interaction.reply({
    content: responseText,
    ephemeral: true,
  });
};

const editMessage = async (interaction, channelId, messageId) => {
  if (!channelId || !messageId) throw { name: "ERROR_MESSAGE_MODIF" };
  const channel = await interaction.guild.channels.fetch(channelId);
  const message = await channel.messages.fetch(messageId);

  if (message) {
    const timestamp = new Date();

    const hours = timestamp.getHours();
    const minutes = timestamp.getMinutes();

    const hoursText = String(hours).padStart(2, "0");
    const minutesText = String(minutes).padStart(2, "0");

    await message.edit({
      content:
        `**${interaction.member.displayName}** ha dejado de buscar` +
        ` en este canal a las ${hoursText}:${minutesText}.`,
      components: [],
    });
  }
};

module.exports = {
  data: { name: "cancel-friendlies" },
  async execute(interaction) {
    const playerId = interaction.user.id;
    const messageId = interaction.message.id;

    try {
      const stopSearchResult = await lobbyAPI.stopSearch(playerId, messageId);
      const {
        isSearching,
        tierId,
        channelId,
        messageId: tierMessageId,
      } = stopSearchResult;
      await editMessage(interaction, channelId, tierMessageId);
      await successfulReply(interaction, isSearching, tierId);
    } catch (e) {
      await exceptionHandler(interaction, e);
    }
  },
};
