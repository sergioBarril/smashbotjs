const { MessageActionRow, MessageButton } = require("discord.js");

const lobbyAPI = require("../api/lobby");
const { TooManyPlayersError } = require("../errors/tooManyPlayers");
const { MESSAGE_TYPES } = require("../models/message");
const { Player } = require("../models/player");
const discordMatchingUtils = require("../utils/discordMatching");

const afkButtonRow = new MessageActionRow().addComponents(
  new MessageButton().setCustomId("accept-afk").setLabel("Sí, buscar otra vez").setStyle("SUCCESS"),
  new MessageButton().setCustomId("decline-afk").setLabel("No, me voy").setStyle("DANGER")
);

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
    content: `**${discordDecliner.displayName}** se durmió en los laureles.`,
    components: [],
  };

  await discordMatchingUtils.editMessages(interaction, declinerMessages, declinerMessage, guild.id);

  const discordRejected = await guild.members.fetch(otherPlayer.discordId);
  const rejectedMessage = {
    content: `**${discordRejected.displayName}** fue brutalmente ignorado.`,
    components: [],
  };
  await discordMatchingUtils.editMessages(interaction, otherMessages, rejectedMessage, guild.id);
};

/**
 * Updates the message for the person that accepted
 * and reported the opponent as afk
 * @param {Interaction} interaction DiscordJS interaction
 * @param {string} acceptedPlayerDiscordId Discord ID of the player that accepted
 */
const editAcceptedDM = async (interaction, acceptedPlayerDiscordId) => {
  const acceptedIsSearching = await lobbyAPI.isSearching(acceptedPlayerDiscordId);
  let acceptedText;
  if (acceptedIsSearching)
    acceptedText = `Como tu rival no respondía, te he vuelto a poner a buscar partida.`;
  else acceptedText = `Parece que tu rival no estaba... ¡Otra vez será! No estás buscando partida.`;

  await interaction.editReply({
    content: acceptedText,
    components: [],
  });
};

/**
 *
 * @param {Interaction} interaction DiscordJS interaction
 * @param {Player} afkPlayer Player that was afk
 * @param {Message} afkDM DM of the player that is afk
 */
const editAfkDM = async (interaction, afkPlayer, afkDM) => {
  const afkIsSearching = await lobbyAPI.isSearching(afkPlayer.discordId);
  const component = [];

  let afkText;
  if (afkIsSearching) {
    afkText = `¿Hola? ¿Hay alguien ahí? No contestaste a un match... ¿Quieres volver a buscar partida?`;
    component.push(afkButtonRow);
  } else
    afkText =
      `¿Hola? ¿Hay alguien ahí? No contestaste al match que tú mismo propusiste... ` +
      `Ya no estás buscando partida.`;

  const newMessage = {
    content: afkText,
    components: component,
  };

  await discordMatchingUtils.editDirectMessage(interaction, afkDM, afkPlayer, newMessage);
};

module.exports = {
  data: { name: "rival-is-afk" },
  async execute(interaction) {
    const acceptedPlayer = interaction.user;
    await interaction.deferUpdate();

    const {
      declinedPlayer,
      otherPlayers,
      messages,
      guild: guildInfo,
    } = await lobbyAPI.timeoutMatch(acceptedPlayer.id);

    const guild = await interaction.client.guilds.fetch(guildInfo.discordId);

    // Messages
    const tierMessages = messages.filter((message) => message.type === MESSAGE_TYPES.LOBBY_TIER);

    const dms = messages.filter((message) => message.type === MESSAGE_TYPES.LOBBY_PLAYER);

    if (otherPlayers.length > 1) throw new TooManyPlayersError();

    const otherPlayer = otherPlayers[0];
    const acceptedDm = dms.find((dm) => dm.playerId == declinedPlayer.id);

    await editAcceptedDM(interaction, acceptedPlayer.id);
    await editAfkDM(interaction, declinedPlayer, acceptedDm);
    await editTierMessages(interaction, tierMessages, guild.id, declinedPlayer, otherPlayer);

    const isSearching = await lobbyAPI.isSearching(otherPlayer.discordId);
    if (!isSearching) return;

    const { rivalPlayer, searchedRanked, foundRanked } = await lobbyAPI.matchmaking(
      otherPlayer.discordId
    );
    const players = [otherPlayer, rivalPlayer];
    if (rivalPlayer) {
      await discordMatchingUtils.matched(guild, players, foundRanked);
    } else {
      await discordMatchingUtils.notMatched(otherPlayer.discordId, guild, null, searchedRanked);
    }
  },
};
