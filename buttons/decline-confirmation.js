const lobbyAPI = require("../api/lobby");
const discordMatchingUtils = require("../utils/discordMatching");

const { MESSAGE_TYPES, Message } = require("../models/message");
const { Player } = require("../models/player");

/**
 * Edits the messages sent in #tier-X
 * @param {Interaction} interaction Discord Button interaction
 * @param {Array<Message>} tierMessages Messages sent in #tier-X
 * @param {string} guildDiscordId Discord ID of the guild of the lobby
 * @param {Player} declinedPlayer Player that declined
 * @param {Array<Player>} otherPlayers Players that didn't decline
 */
const editTierMessages = async (
  interaction,
  tierMessages,
  guildDiscordId,
  declinedPlayer,
  otherPlayers
) => {
  const declinerMessagesInfo = tierMessages.filter((m) => m.playerId === declinedPlayer.id);
  const otherMessagesInfo = tierMessages.filter((m) => m.playerId !== declinedPlayer.id);

  if (tierMessages.length < 0) return;

  const guild = await interaction.client.guilds.fetch(guildDiscordId);

  const declinerMessages = [];
  for (let messageInfo of declinerMessagesInfo) {
    const channel = await guild.channels.fetch(messageInfo.channelId);
    const message = await channel.messages.fetch(messageInfo.discordId);

    const player = await guild.members.fetch(declinedPlayer.discordId);
    declinerMessages.push({ message, player });
  }

  const otherMessages = [];
  for (let messageInfo of otherMessagesInfo) {
    const channel = await guild.channels.fetch(messageInfo.channelId);
    const message = await channel.messages.fetch(messageInfo.discordId);

    const otherPlayer = otherPlayers.find((player) => player.id === messageInfo.playerId);
    const player = await guild.members.fetch(otherPlayer.discordId);
    otherMessages.push({ message, player });
  }

  // Edit messages
  for (let { message, player } of declinerMessages) {
    await message.edit({
      content: `**${player.displayName}** rechazó la partida encontrada.`,
      components: [],
    });
  }

  for (let { message, player } of otherMessages) {
    await message.edit({
      content: `**${player.displayName}** fue brutalmente rechazado.`,
      components: [],
    });
  }
};

/**
 * Edits the DMs, and checks if the opponent is searching
 * @param {*} interaction DiscordJS Interaction
 * @param {Array<Player>} otherPlayers List of players that didn't decline
 * @param {Array<Message>} directMessages List of DMs
 * @returns
 */
const editDirectMessages = async (interaction, otherPlayers, directMessages) => {
  let rejectedIsSearching;

  for (let otherPlayer of otherPlayers) {
    const player = await interaction.client.users.fetch(otherPlayer.discordId);
    const messageInfo = directMessages.find((m) => m.playerId === otherPlayer.id);
    const message = await player.dmChannel.messages.fetch(messageInfo.discordId);

    rejectedIsSearching = await lobbyAPI.isSearching(player.id);

    let rejectedText = `Tu rival ha **rechazado** la partida.`;
    if (rejectedIsSearching) rejectedText += ` Te he vuelto a poner a buscar partida.`;
    else rejectedText += ` Ahora no estás buscando partida.`;
    await message.edit({
      content: rejectedText,
      components: [],
    });
  }

  await interaction.update({
    content:
      `Has rechazado la partida, y te he sacado de todas las búsquedas de partida.\n` +
      `¡Espero volver a verte pronto!`,
    components: [],
  });

  return rejectedIsSearching;
};

const execute = async (interaction) => {
  const playerDiscordId = interaction.user.id;
  const {
    declined,
    otherPlayers,
    messages,
    guild: guildInfo,
  } = await lobbyAPI.matchNotAccepted(playerDiscordId, false);

  const guild = await interaction.client.guilds.fetch(guildInfo.discordId);

  // Messages
  const tierMessages = messages.filter((message) => message.type === MESSAGE_TYPES.LOBBY_TIER);

  const dms = messages.filter((message) => message.type === MESSAGE_TYPES.LOBBY_PLAYER);
  const otherDms = dms.filter((dm) => dm.playerId != declined.id);

  await editTierMessages(interaction, tierMessages, guild.id, declined, otherPlayers);
  await editDirectMessages(interaction, otherPlayers, otherDms);

  for (let otherPlayer of otherPlayers) {
    const isSearching = await lobbyAPI.isSearching(otherPlayer.discordId);
    if (!isSearching) continue;

    const rivalPlayer = await lobbyAPI.matchmaking(otherPlayer.discordId);
    const players = [otherPlayer, rivalPlayer];
    if (rivalPlayer) {
      await discordMatchingUtils.matched(guild, players);
    } else {
      await discordMatchingUtils.notMatched(otherPlayer.discordId, guild);
    }
  }
};

module.exports = {
  data: { name: "decline-confirmation" },
  execute,
};
