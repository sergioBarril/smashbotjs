const lobbyAPI = require("../api/lobby");
const discordMatchingUtils = require("../utils/discordMatching");

const { MESSAGE_TYPES, Message } = require("../models/message");
const { Player } = require("../models/player");
const { TooManyPlayersError } = require("../errors/tooManyPlayers");

/**
 * Edits the messages sent in #tier-X
 * @param {Interaction} interaction Discord Button interaction
 * @param {Array<Message>} tierMessages Messages sent in #tier-X
 * @param {string} guildDiscordId Discord ID of the guild of the lobby
 * @param {Player} declinedPlayer Player that declined
 * @param {Player} otherPlayer Player that didn't decline
 */
const editTierMessages = async (
  interaction,
  tierMessages,
  guildDiscordId,
  declinedPlayer,
  otherPlayer
) => {
  if (tierMessages.length < 0) return;

  const declinerMessages = tierMessages.filter((m) => m.playerId === declinedPlayer.id);
  const otherMessages = tierMessages.filter((m) => m.playerId === otherPlayer.id);

  const guild = await interaction.client.guilds.fetch(guildDiscordId);

  const discordDecliner = await guild.members.fetch(declinedPlayer.discordId);
  const declinerMessage = {
    content: `**${discordDecliner.displayName}** rechazó la partida encontrada.`,
    components: [],
  };

  await discordMatchingUtils.editMessages(interaction, declinerMessages, declinerMessage, guild.id);

  const discordRejected = await guild.members.fetch(otherPlayer.discordId);
  const rejectedMessage = {
    content: `**${discordRejected.displayName}** fue brutalmente rechazado.`,
    components: [],
  };
  await discordMatchingUtils.editMessages(interaction, otherMessages, rejectedMessage, guild.id);
};

/**
 * Edits the DM of the rejected player
 * @param {Interaction} interaction DiscordJS Interaction
 * @param {Player} otherPlayer Player that didn't decline
 * @param {Message} dm DM of the player that didn't decline
 * @returns
 */
const editRejectedDM = async (interaction, otherPlayer, dm) => {
  const rejectedIsSearching = await lobbyAPI.isSearching(otherPlayer.discordId);

  let rejectedText = `Tu rival ha **rechazado** la partida.`;
  if (rejectedIsSearching) rejectedText += ` Te he vuelto a poner a buscar partida.`;
  else rejectedText += ` Ahora no estás buscando partida.`;

  const newMessage = {
    content: rejectedText,
    components: [],
  };

  await discordMatchingUtils.editDirectMessage(interaction, dm, otherPlayer, newMessage);
};

const editDeclinerDM = async (interaction) => {
  await interaction.editReply({
    content:
      `Has rechazado la partida, y te he sacado de todas las búsquedas de partida.\n` +
      `¡Espero volver a verte pronto!`,
    components: [],
  });
};

const execute = async (interaction) => {
  await interaction.deferUpdate();

  const playerDiscordId = interaction.user.id;
  const {
    declinedPlayer,
    otherPlayers,
    messages,
    guild: guildInfo,
  } = await lobbyAPI.matchNotAccepted(playerDiscordId, false);

  const guild = await interaction.client.guilds.fetch(guildInfo.discordId);

  // Messages
  const tierMessages = messages.filter((message) => message.type === MESSAGE_TYPES.LOBBY_TIER);

  const dms = messages.filter((message) => message.type === MESSAGE_TYPES.LOBBY_PLAYER);

  if (otherPlayers.length > 1) throw new TooManyPlayersError();

  const otherPlayer = otherPlayers[0];
  const otherDm = dms.find((dm) => dm.playerId == otherPlayer.id);

  await editDeclinerDM(interaction);
  await editRejectedDM(interaction, otherPlayer, otherDm);
  await editTierMessages(interaction, tierMessages, guild.id, declinedPlayer, otherPlayer);

  const isSearching = await lobbyAPI.isSearching(otherPlayer.discordId);
  if (!isSearching) return;

  const rivalPlayer = await lobbyAPI.matchmaking(otherPlayer.discordId);
  const players = [otherPlayer, rivalPlayer];
  if (rivalPlayer) {
    await discordMatchingUtils.matched(guild, players);
  } else {
    await discordMatchingUtils.notMatched(otherPlayer.discordId, guild);
  }
};

module.exports = {
  data: { name: "decline-confirmation" },
  execute,
};
