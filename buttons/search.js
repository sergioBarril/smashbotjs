const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");

const { Tier } = require("../models/tier");
const { Player } = require("../models/player");
const { Message } = require("../models/message");
const { Interaction } = require("discord.js");
const winston = require("winston");

/**
 * Actions to do after finding a match
 * This includes:
 *  - sending the confirmation DMs
 *  - editing existing #tier-X messages
 * @param {*} interaction
 * @param {Array<Player>} players
 * @param {boolean} isRanked
 */
const matched = async (interaction, players, isRanked) => {
  const guild = interaction.guild;
  await discordMatchingUtils.matched(guild, players, isRanked);

  await interaction.editReply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
};

/**
 * Actions to do after not finding a match
 * This includes sending a message to #tier
 * @param {Interaction} interaction discord.js event interaction
 * @param {Array<Tier>} tiers Tiers that have been added in this interaction
 * @param {boolean} isRanked True iff tried to search in ranked
 */
const notMatched = async (interaction, tiers, isRanked) => {
  const playerId = interaction.user.id;
  const guild = interaction.guild;

  let roles = [];

  for (let tier of tiers) {
    await discordMatchingUtils.notMatched(playerId, guild, tier);
    const tierRole = await guild.roles.fetch(tier.roleId);
    if (tier.yuzu) roles.push("**Yuzu**");
    else roles.push(`${tierRole}`);
  }

  const rolesFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });

  let rolesNames = rolesFormatter.format(roles);

  if (isRanked) {
    rolesNames = "**Ranked**";
    await discordMatchingUtils.notMatched(playerId, guild, null, isRanked, true);
  }

  winston.info(`A partir de ahora, ${interaction.user.username} está buscando en ${rolesNames}`);

  await interaction.editReply({
    content: `A partir de ahora estás buscando en ${rolesNames}.`,
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
  const guildId = interaction.guild.id;
  const playerId = interaction.user.id;
  const messageId = interaction.customId === "search" ? interaction.message.id : null;

  await interaction.deferReply({ ephemeral: true });

  winston.info(`${interaction.user.username} triggered a Search.`);

  const searchResult = await lobbyAPI.search(playerId, guildId, messageId);
  await deleteAfkMessages(interaction, searchResult.afkMessages);
  if (searchResult.matched) {
    await matched(interaction, searchResult.players, searchResult.foundRanked);
  } else {
    await notMatched(interaction, searchResult.tiers, searchResult.searchedRanked);
  }
};

module.exports = {
  data: { name: "search" },
  execute,
};
