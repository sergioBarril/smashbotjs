const lobbyAPI = require("../api/lobby");
const discordMatchingUtils = require("../utils/discordMatching");

const { MessageActionRow, MessageButton } = require("discord.js");

const editTierMessages = async (interaction, messagesInfo) => {
  const playerDiscordId = interaction.user.id;

  const declinerMessagesInfo = messagesInfo.filter((info) => info.player_id === playerDiscordId);
  const otherMessagesInfo = messagesInfo.filter((info) => info.player_id !== playerDiscordId);

  if (messagesInfo.length < 0) return false;
  const guildId = messagesInfo[0].guild_id;
  const guild = await interaction.client.guilds.fetch(guildId);

  const declinerMessages = [];

  for (messageInfo of declinerMessagesInfo) {
    const channel = await guild.channels.fetch(messageInfo.channel_id);
    const message = await channel.messages.fetch(messageInfo.message_id);

    const player = await guild.members.fetch(messageInfo.player_id);
    declinerMessages.push({ message, player });
  }

  const otherMessages = [];
  for (messageInfo of otherMessagesInfo) {
    const channel = await guild.channels.fetch(messageInfo.channel_id);
    const message = await channel.messages.fetch(messageInfo.message_id);

    const player = await guild.members.fetch(messageInfo.player_id);
    otherMessages.push({ message, player });
  }

  // Edit messages
  for ({ message, player } of declinerMessages) {
    await message.edit({
      content: `**${player.displayName}** rechazó la partida encontrada.`,
      components: [],
    });
  }

  for ({ message, player } of otherMessages) {
    await message.edit({
      content: `**${player.displayName}** fue brutalmente rechazado.`,
      components: [],
    });
  }
  return true;
};

const editDirectMessages = async (interaction, otherPlayersInfo) => {
  let rejectedHasTiers;

  for (info of otherPlayersInfo) {
    const player = await interaction.client.users.fetch(info.discord_id);
    const message = await player.dmChannel.messages.fetch(info.message_id);

    rejectedHasTiers = await lobbyAPI.hasLobbyTiers(player.id);

    let rejectedText = `Tu rival ha **rechazado** la partida.`;
    if (rejectedHasTiers) rejectedText += ` Te he vuelto a poner a buscar partida.`;
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

  return rejectedHasTiers;
};

const execute = async (interaction) => {
  const playerDiscordId = interaction.user.id;
  const playersInfo = await lobbyAPI.declineMatch(playerDiscordId);
  const guildId = playersInfo.guild;

  const guild = await interaction.client.guilds.fetch(guildId);

  // Messages
  const messagesInfo = playersInfo.messagesInfo;
  await editTierMessages(interaction, messagesInfo);
  await editDirectMessages(interaction, playersInfo.others);

  for (player of playersInfo.others) {
    const hasTierToSearch = await lobbyAPI.hasLobbyTiers(player.discord_id);
    if (!hasTierToSearch) continue;

    const rivalPlayer = await lobbyAPI.matchmaking(player.player_id, player.lobby_id);
    if (rivalPlayer) {
      const playerIdList = [player.discord_id, rivalPlayer.discord_id];
      await discordMatchingUtils.matched(guild, playerIdList);
    } else {
      await discordMatchingUtils.notMatched(player.discord_id, guild);
    }
  }
};

module.exports = {
  data: { name: "decline-confirmation" },
  execute,
};
