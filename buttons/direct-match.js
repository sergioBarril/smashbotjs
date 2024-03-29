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

  winston.info(`${interaction.user.username} ha matcheado de forma directa`);

  await interaction.editReply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
};

/**
 * If the player was afk and started searching, delete the AFK message.
 * @param {*} interaction Discord Interaction
 * @param {List<Message>} messages Message model
 */
const deleteAfkMessages = async (interaction, messages) => {
  const dms = messages.filter((m) => m.channelId == null);
  const gms = messages.filter((m) => m.channelId != null);

  for (let dm of dms) {
    const member = await interaction.guild.members.fetch(dm.authorId);
    const dmChannel = await member.user.createDM();
    const discordMessage = await dmChannel.messages.fetch(dm.discordId);
    await discordMessage.delete();

    winston.debug(`Discord Message con id ${dm.discordId} eliminado.`);
  }

  for (let gm of gms) {
    const channel = await interaction.guild.channels.fetch(gm.channelId);
    const discordMessage = await channel.messages.fetch(gm.discordId);
    await discordMessage.delete();

    winston.debug(`Discord Message con id ${gm.discordId} eliminado.`);
  }
};

const execute = async (interaction) => {
  const playerId = interaction.user.id;
  const messageId = interaction.message.id;

  await interaction.deferReply({ ephemeral: true });
  const searchResult = await lobbyAPI.directMatch(playerId, messageId);
  await deleteAfkMessages(interaction, searchResult.afkMessages);
  await matched(interaction, searchResult.players);
};

module.exports = {
  data: { name: "direct-match" },
  execute,
};
