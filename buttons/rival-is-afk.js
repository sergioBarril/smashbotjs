const { MessageActionRow, MessageButton, Permissions } = require("discord.js");

const lobbyAPI = require("../api/lobby");
const discordMatchingUtils = require("../utils/discordMatching");

const row = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId("accept-afk")
    .setLabel("Sí, buscar otra vez")
    .setStyle("SUCCESS"),
  new MessageButton()
    .setCustomId("decline-afk")
    .setLabel("No, me voy")
    .setStyle("DANGER")
);

// This assumes 1 vs 1. Check for others
const editTierMessages = async (interaction, messagesInfo) => {
  const playerDiscordId = interaction.user.id;

  const declinerMessagesInfo = messagesInfo.filter(
    (info) => info.player_id !== playerDiscordId
  );
  const otherMessagesInfo = messagesInfo.filter(
    (info) => info.player_id === playerDiscordId
  );

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
      content: `**${player.displayName}** se durmió en los laureles.`,
      components: [],
    });
  }

  for ({ message, player } of otherMessages) {
    await message.edit({
      content: `**${player.displayName}** fue brutalmente ignorado.`,
      components: [],
    });
  }
  return true;
};

const editDirectMessages = async (interaction, afkInfo) => {
  const player = await interaction.client.users.fetch(afkInfo.discord_id);
  const message = await player.dmChannel.messages.fetch(afkInfo.message_id);

  const afkHasTiers = await lobbyAPI.hasLobbyTiers(player.id);
  const acceptedHasTiers = await lobbyAPI.hasLobbyTiers(interaction.user.id);

  let afkText;
  const component = [];

  if (afkHasTiers) {
    afkText = `¿Hola? ¿Hay alguien ahí? No contestaste a un match... ¿Quieres volver a buscar partida?`;
    component.push(row);
  } else
    afkText =
      `¿Hola? ¿Hay alguien ahí? No contestaste al match que tú mismo propusiste... ` +
      `Ya no estás buscando partida.`;

  await message.edit({
    content: afkText,
    components: component,
  });

  let acceptedText;
  if (acceptedHasTiers)
    acceptedText = `Como tu rival no respondía, te he vuelto a poner a buscar partida.`;
  else
    acceptedText = `Parece que tu rival no estaba... ¡Otra vez será! No estás buscando partida.`;

  await interaction.update({
    content: acceptedText,
    components: [],
  });

  return acceptedHasTiers;
};

module.exports = {
  data: { name: "rival-is-afk" },
  async execute(interaction) {
    const acceptedPlayer = interaction.user;

    const timeoutInfo = await lobbyAPI.timeoutMatch(acceptedPlayer.id);

    const guildId = timeoutInfo.guild;
    const guild = await interaction.client.guilds.fetch(guildId);

    // Messages
    const messagesInfo = timeoutInfo.messagesInfo;
    await editTierMessages(interaction, messagesInfo);
    const acceptedHasTiers = await editDirectMessages(
      interaction,
      timeoutInfo.declined[0]
    );

    if (acceptedHasTiers)
      for (player of timeoutInfo.others) {
        const rivalPlayer = await lobbyAPI.matchmaking(
          player.player_id,
          player.lobby_id
        );
        if (rivalPlayer) {
          const playerIdList = [player.discord_id, rivalPlayer.discord_id];
          await discordMatchingUtils.matched(guild, playerIdList);
        } else {
          await discordMatchingUtils.notMatched(player.discord_id, guild);
        }
      }
  },
};
