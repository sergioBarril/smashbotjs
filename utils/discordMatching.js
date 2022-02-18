const { MessageActionRow, MessageButton } = require("discord.js");

const lobbyAPI = require("../api/lobby");
const guildAPI = require("../api/guild");

// This module is composed of Discord functionality that's
// recurring in different buttons or commands

const sendConfirmation = async (player, opponent) => {
  // Sends a DM to player asking for confirmation
  // about their match with opponent
  const messageText = `¡Match encontrado! ${player}, te toca contra **${opponent.displayName}**`;
  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("accept-confirmation")
      .setLabel("Aceptar")
      .setStyle("SUCCESS"),
    new MessageButton()
      .setCustomId("decline-confirmation")
      .setLabel("Rechazar")
      .setStyle("DANGER")
  );
  const directMessage = await player.send({
    content: messageText,
    components: [row],
  });

  await lobbyAPI.saveDirectMessage(player.id, directMessage.id);

  return true;
};

const matched = async (guild, playerIdList) => {
  // Actions to do after a match has been found
  //  This includes :
  //   - sending the confirmation DMS
  //   - editing existing #tier-X messages
  // Arguments:
  //   - guild: The Discord object
  //   - playerIdList: list of discord_ids of the players matched

  // Get players
  const players = [];
  for (playerDiscordId of playerIdList) {
    const player = await guild.members.fetch(playerDiscordId);
    players.push(player);
  }

  if (players.length > 2) throw { name: "TOO_MANY_PLAYERS" };

  // Send DMs
  const [player1, player2] = players;
  await Promise.all([
    sendConfirmation(player1, player2),
    sendConfirmation(player2, player1),
  ]);

  // Update all your #tier messages
  const messages = await lobbyAPI.getTierMessages(player1.id);

  const button = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("direct-match")
      .setLabel("Jugar")
      .setStyle("SUCCESS")
      .setDisabled(true)
  );

  for (messageInfo of messages) {
    const { messageId, channelId, authorId } = messageInfo;
    const channel = await guild.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    const player = await guild.members.fetch(authorId);

    await message.edit({
      content: `¡**${player.displayName}** ha encontrado partida! Esperando confirmación...`,
      components: [button],
    });
  }
};

const notMatched = async (playerId, guild, tierInfo = null) => {
  // Actions to do after not finding a match
  // This includes sending a message to #tier

  const button = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("direct-match")
      .setLabel("Jugar")
      .setStyle("SUCCESS")
  );

  const member = await guild.members.fetch(playerId);

  let tiersInfo = [];
  if (tierInfo) tiersInfo.push(tierInfo);
  else tiersInfo = await lobbyAPI.getTierChannels(playerId);

  for (tierInfo of tiersInfo) {
    const { tier_id: tierId, channel_id: channelId } = tierInfo;
    const channel = await guild.channels.fetch(channelId);
    const tierRole = await guild.roles.fetch(tierId);

    const message = await channel.send({
      content:
        `${tierRole} - **${member.displayName}**` +
        ` está buscando partida en **${tierRole.name}**`,
      components: [button],
    });

    await lobbyAPI.saveSearchTierMessage(playerId, tierId, message.id);
  }
};

const newSearchMessageText = (message, tier, playerNames) => {
  const memberFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const memberNames = memberFormatter.format(
    playerNames.map((name) => `*${name}*`)
  );

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
