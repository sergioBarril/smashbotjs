const { MessageActionRow, MessageButton, GuildMember } = require("discord.js");

const lobbyAPI = require("../api/lobby");
const guildAPI = require("../api/guild");
const messageAPI = require("../api/message");
const rolesAPI = require("../api/roles");

const smashCharacters = require("../params/smashCharacters.json");
const { TooManyPlayersError } = require("../errors/tooManyPlayers");
const { Player } = require("../models/player");
const { Tier } = require("../models/tier");

// This module is composed of Discord functionality that's
// recurring in different buttons or commands

/**
 * Sends a DM to player asking for confirmation
 * about their match with opponent
 * @param {GuildMember} player Receiver of this DM
 * @param {GuildMember} opponent Opponent who 'player' is supposed to play against
 */
async function sendConfirmation(player, opponent) {
  const messageText = `¡Match encontrado! ${player}, te toca contra **${opponent.displayName}**`;
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("accept-confirmation").setLabel("Aceptar").setStyle("SUCCESS"),
    new MessageButton().setCustomId("decline-confirmation").setLabel("Rechazar").setStyle("DANGER")
  );
  const directMessage = await player.send({
    content: messageText,
    components: [row],
  });

  await messageAPI.saveConfirmationDM(player.id, directMessage.id);
}

/**
 * Actions to do after a match has been found
 * This includes:
 *  - sending the confirmation DMs
 *  - editing existing #tier-X messages
 *
 * @param {Guild} guild The Discord object
 * @param {Array<Player>} players List of players matched
 */
const matched = async (guild, players) => {
  players = await Promise.all(
    players.map(async (player) => await guild.members.fetch(player.discordId))
  );

  if (players.length > 2) throw new TooManyPlayersError();

  // Send DMs
  const [player1, player2] = players;
  await Promise.all([sendConfirmation(player1, player2), sendConfirmation(player2, player1)]);

  // Update all your #tier messages
  const messages = await messageAPI.getSearchTierMessages(player1.id);

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
 * @param {Guild} guild
 * @param {Tier} tier Tier where last tried to match. Null if it's not only one tier.
 */
const notMatched = async (playerId, guild, tier = null) => {
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

  let tiers = [];
  if (tier) tiers.push(tier);
  else tiers = await lobbyAPI.getSearchingTiers(playerId);

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

const updateSearch = async (guild) => {
  const groupedTiers = await guildAPI.getCurrentList(guild.id);
  const searchChannelId = await guildAPI.getMatchmakingChannel(guild.id);

  const searchChannel = await guild.channels.fetch(searchChannelId);

  for (const [key, value] of Object.entries(groupedTiers)) {
    const [tierId, messageId] = key.split(",");
    const tier = await guild.roles.fetch(tierId);
    const message = await searchChannel.messages.fetch(messageId);

    const playerNames = await Promise.all(
      value.map(async (playerId) => {
        const player = await guild.members.fetch(playerId);
        return player.displayName;
      })
    );

    const newText = newSearchMessageText(message, tier, playerNames);

    await message.edit({ content: newText });
    console.log(`Updated ${tier.name}`);
  }
};

module.exports = {
  matched,
  notMatched,
  updateSearch,
};
