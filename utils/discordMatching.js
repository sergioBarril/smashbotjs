const { MessageActionRow, MessageButton, GuildMember, Guild } = require("discord.js");

const lobbyAPI = require("../api/lobby");
const messageAPI = require("../api/message");
const rolesAPI = require("../api/roles");
const ratingAPI = require("../api/rating");
const guildAPI = require("../api/guild");

const smashCharacters = require("../params/smashCharacters.json");
const { TooManyPlayersError } = require("../errors/tooManyPlayers");
const { Player } = require("../models/player");
const { Tier } = require("../models/tier");
const { MESSAGE_TYPES } = require("../models/message");
const winston = require("winston");

// This module is composed of Discord functionality that's
// recurring in different buttons or commands

/**
 * Sends a DM to player asking for confirmation
 * about their match with opponent
 * @param {GuildMember} player Receiver of this DM
 * @param {GuildMember} opponent Opponent who 'player' is supposed to play against
 * @param {boolean} isRanked True if the DMs are for a ranked match
 * @param {Guild} guild DiscordJS guild object
 */
async function sendConfirmation(player, opponent, isRanked, guild) {
  let messageText = `¡Match encontrado! ${player}, te toca contra **${opponent.displayName}**`;

  if (isRanked) {
    const opponentTier = await ratingAPI.getPlayerTier(opponent.id, guild.id);
    const discordTier = await guild.roles.fetch(opponentTier.roleId);
    messageText = `¡Match ranked encontrado! ${player}, te toca contra alguien de **${discordTier.name}**`;
  }
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("accept-confirmation").setLabel("Aceptar").setStyle("SUCCESS"),
    new MessageButton().setCustomId("decline-confirmation").setLabel("Rechazar").setStyle("DANGER")
  );
  const directMessage = await player.send({
    content: messageText,
    components: [row],
  });

  await messageAPI.saveConfirmationDM(player.id, directMessage.id, isRanked);
}

/**
 * Actions to do after a match has been found
 * This includes:
 *  - sending the confirmation DMs
 *  - editing existing #tier-X messages
 *
 * @param {Guild} guild The Discord object
 * @param {Array<Player>} players List of players matched
 * @param {boolean} isRanked True iff this is a ranked match
 */
const matched = async (guild, players, isRanked) => {
  if (players.length > 2) throw new TooManyPlayersError();

  players = await Promise.all(
    players.map(async (player) => await guild.members.fetch(player.discordId))
  );

  // Send DMs
  const [player1, player2] = players;

  winston.info(`${player1.displayName} y ${player2.displayName} han hecho match.`);

  await Promise.all([
    sendConfirmation(player1, player2, isRanked, guild),
    sendConfirmation(player2, player1, isRanked, guild),
  ]);

  // Update all your #tier messages
  let messages;
  if (isRanked) messages = await messageAPI.popSearchTierMessages(player1.id);
  else messages = await messageAPI.getSearchTierMessages(player1.id);

  const rankedMessage1 = await messageAPI.popRankedMessage(player1.id);
  const rankedMessage2 = await messageAPI.popRankedMessage(player2.id);

  // Delete ranked messages
  const rankedMessages = [rankedMessage1, rankedMessage2].filter((m) => m !== null);
  for (let message of rankedMessages) {
    const channel = await guild.channels.fetch(message.channelId);
    const discordMessage = await channel.messages.fetch(message.discordId);
    discordMessage.delete();
  }

  const button = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("direct-match")
      .setLabel("Jugar")
      .setStyle("SUCCESS")
      .setDisabled(true)
  );

  for (let message of messages) {
    const channel = await guild.channels.fetch(message.channelId);
    const discordMessage = await channel.messages.fetch(message.discordId);
    const player = await guild.members.fetch(message.authorId);

    if (isRanked) await discordMessage.delete();
    else
      await discordMessage.edit({
        content: `¡**${player.displayName}** ha encontrado partida! Esperando confirmación...`,
        components: [button],
      });
  }
};

/**
 * Actions to do after not finding a match
 * This includes sending a message to #tier-X
 *
 * @param {string} playerId DiscordId of the player
 * @param {Guild} guild Discord Guild object
 * @param {Tier} tier Tier where last tried to match. Null if it's not only one tier.
 * @param {boolean} isRanked True if this comes from searching in ranked
 * @param {boolean} isOnlyRanked True if should ignore tiers alltogether
 */
const notMatched = async (playerId, guild, tier = null, isRanked = false, isOnlyRanked = false) => {
  const button = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("direct-match").setLabel("Jugar").setStyle("SUCCESS")
  );

  const member = await guild.members.fetch(playerId);
  const { mains, seconds } = await rolesAPI.getCharacters(playerId);

  const characters = mains.concat(seconds);

  let charsText = "";
  if (characters.length > 0) {
    const charsEmojis = characters.map((char) => smashCharacters[char.name].emoji);
    charsText = ` (${charsEmojis.join("")})`;
  }

  if (isRanked) {
    const assignedTier = await ratingAPI.getPlayerTier(playerId, guild.id);
    const rankedRole = await guild.roles.fetch(assignedTier.rankedRoleId);
    const rankedChannelId = await guildAPI.getRankedChannel(guild.id);
    const rankedChannel = await guild.channels.fetch(rankedChannelId);

    const message = await rankedChannel.send({
      content: `${rankedRole} - **Alguien** está buscando partida clasificatoria.`,
    });
    await messageAPI.saveSearchRankedMessage(playerId, message.id);
  }

  let tiers = [];
  if (tier) tiers.push(tier);
  else if (!isOnlyRanked) tiers = await lobbyAPI.getSearchingTiers(playerId);

  for (let tier of tiers) {
    const channel = await guild.channels.fetch(tier.channelId);

    let messageContent = "";

    if (tier.yuzu) {
      const roleIds = await rolesAPI.getYuzuRolesForMessage(member.id, guild.id);
      messageContent = roleIds.map((roleId) => `<@&${roleId}>`).join(" ");
      messageContent += ` - **${member.displayName}**${charsText} está buscando partida en **Yuzu**.`;
    } else {
      const tierRole = await guild.roles.fetch(tier.roleId);
      messageContent =
        `${tierRole} - **${member.displayName}**${charsText}` +
        ` está buscando partida en **${tierRole.name}**.`;
    }
    const message = await channel.send({
      content: messageContent,
      components: [button],
    });

    await messageAPI.saveSearchTierMessage(playerId, tier.roleId, message.id, tier.yuzu);
  }
};

const newSearchMessageText = (message, tier, playerNames) => {
  const memberFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const memberNames = memberFormatter.format(playerNames.map((name) => `*${name}*`));

  let messageText = `**${tier.name}**`;
  if (playerNames.length > 0) messageText += `\n${memberNames}`;

  return messageText;
};

/**
 * Edits the messages sent in #tier-X
 * @param {Interaction} interaction Discord Button interaction
 * @param {Array<Message>} messages Messages to edit
 * @param {Object} newMessage Content and components of the new message
 * @param {string} guildDiscordId Discord ID of the guild of the lobby
 */
const editMessages = async (interaction, messages, newMessage, guildDiscordId) => {
  if (messages.length < 0) return;

  const guild = await interaction.client.guilds.fetch(guildDiscordId);

  const discordMessages = await Promise.all(
    messages.map(async (message) => {
      const channel = await guild.channels.fetch(message.channelId);
      return await channel.messages.fetch(message.discordId);
    })
  );

  for (let message of discordMessages) {
    await message.edit(newMessage);
  }
};

/**
 * Edits the direct message
 * @param {Interaction} interaction Discord Button interaction
 * @param {Message} message Message to edit
 * @param {Player} player Player that needs their message edited
 * @param {Object} newMessage Content and components of the new message
 */
const editDirectMessage = async (interaction, message, player, newMessage) => {
  const discordPlayer = await interaction.client.users.fetch(player.discordId);
  const dmChannel = await discordPlayer.createDM();
  const discordMessage = await dmChannel.messages.fetch(message.discordId);
  await discordMessage.edit(newMessage);
};

module.exports = {
  matched,
  notMatched,
  editMessages,
  editDirectMessage,
};
