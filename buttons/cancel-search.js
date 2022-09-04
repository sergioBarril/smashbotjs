const lobbyAPI = require("../api/lobby");
const { CustomError } = require("../errors/customError");
const { EditMessageError } = require("../errors/editMessage");

const exceptionHandler = async (interaction, exception) => {
  let message = exception.message;

  if (exception.name === "LobbyNotFoundError") {
    message = "¡No estabas buscando partida!";
  } else if (!(exception instanceof CustomError)) {
    message = "Ha habido un error inesperado. Habla con un admin para que mire los logs.";
    console.error(exception, exception.stack);
  }

  await interaction.reply({
    content: message,
    ephemeral: true,
  });
};

const successfulReply = async (interaction, isSearching, tiers) => {
  const roles = tiers.map((tier) => (tier.yuzu ? `**Yuzu**` : `<@&${tier.roleId}>`));

  const rolesFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const rolesNames = rolesFormatter.format(roles);

  let responseText = `A partir de ahora **no** estás buscando partida en ${rolesNames}`;

  if (!isSearching) responseText = `Ya no estás buscando partida. ¡Hasta pronto!`;

  return await interaction.reply({
    content: responseText,
    ephemeral: true,
  });
};

const editMessage = async (interaction, channelId, messageId, isRanked) => {
  if (!channelId || !messageId) throw new EditMessageError();

  const channel = await interaction.guild.channels.fetch(channelId);
  const message = await channel.messages.fetch(messageId);

  if (message) {
    if (isRanked) return await message.delete();
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
  data: { name: "cancel-search" },
  async execute(interaction) {
    const playerId = interaction.user.id;
    const messageId = interaction.customId === "cancel-search" ? interaction.message.id : null;

    try {
      const stopSearchResult = await lobbyAPI.stopSearch(playerId, messageId);
      const { isSearching, messages, tiers } = stopSearchResult;

      for (let message of messages) {
        await editMessage(interaction, message.channelId, message.discordId, message.ranked);
      }
      await successfulReply(interaction, isSearching, tiers);
    } catch (e) {
      await exceptionHandler(interaction, e);
    }
  },
};
