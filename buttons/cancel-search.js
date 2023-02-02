const winston = require("winston");
const lobbyAPI = require("../api/lobby");
const { EditMessageError } = require("../errors/editMessage");

const successfulReply = async (interaction, isSearching, tiers, isRanked) => {
  const roles = tiers.map((tier) => (tier.yuzu ? `**Yuzu**` : `<@&${tier.roleId}>`));

  const rolesFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  let rolesNames = rolesFormatter.format(roles);

  if (isRanked) rolesNames = `**Ranked**`;

  let responseText = `A partir de ahora **no** estás buscando partida en ${rolesNames}.`;

  winston.info(`${interaction.user.username} ha dejado de buscar en ${rolesNames}`);

  if (!isSearching) {
    responseText = `Ya no estás buscando partida. ¡Hasta pronto!`;
    winston.info(`${interaction.user.username} ya no está buscando partida.`);
  }

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

    winston.debug(`Mensaje ${messageId} ha sido modificado`);
  }
};

module.exports = {
  data: { name: "cancel-search" },
  async execute(interaction) {
    const playerId = interaction.user.id;
    const messageId = interaction.customId === "cancel-search" ? interaction.message.id : null;

    const stopSearchResult = await lobbyAPI.stopSearch(playerId, messageId);
    const { isSearching, messages, tiers, isRanked } = stopSearchResult;

    for (let message of messages) {
      await editMessage(interaction, message.channelId, message.discordId, message.ranked);
    }
    await successfulReply(interaction, isSearching, tiers, isRanked);
  },
};
