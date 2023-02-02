const discordMatchingUtils = require("../utils/discordMatching");
const lobbyAPI = require("../api/lobby");
const winston = require("winston");

/**
 * Actions to do after finding a match
 * This includes:
 *  - sending the confirmation DMs
 *  - editing existing #tier-X messages
 * @param {*} interaction
 * @param {Array<Player>} players
 */
const matched = async (interaction, players) => {
  const guild = interaction.guild;
  await discordMatchingUtils.matched(guild, players);

  winston.info(`${interaction.user.username} ha matcheado con ${players} de forma directa`);

  await interaction.editReply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
};

/**
 * If the player was afk and started searching, delete the AFK message.
 * @param {*} interaction Discord Interaction
 * @param {Message} message Message model
 */
const deleteAfkMessage = async (interaction, message) => {
  if (!message) return;
  const discordMessage = await interaction.user.dmChannel.messages.fetch(message.discordId);
  await discordMessage.delete();
};

const execute = async (interaction) => {
  const playerId = interaction.user.id;
  const messageId = interaction.message.id;

  await interaction.deferReply({ ephemeral: true });
  const searchResult = await lobbyAPI.directMatch(playerId, messageId);
  await deleteAfkMessage(interaction, searchResult.afkMessage);
  await matched(interaction, searchResult.players);
};

module.exports = {
  data: { name: "direct-match" },
  execute,
};
