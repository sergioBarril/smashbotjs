const lobbyAPI = require("../api/lobby");

const lobbyDB = require("../db/lobby");
const guildDB = require("../db/guild");

const { MessageActionRow, MessageButton, Permissions } = require("discord.js");

// Disabled buttons
const row = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId("accept-confirmation")
    .setLabel("Aceptar")
    .setStyle("SUCCESS")
    .setDisabled(),
  new MessageButton()
    .setCustomId("decline-confirmation")
    .setLabel("Rechazar")
    .setStyle("DANGER")
    .setDisabled()
);

const timeoutButtons = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId("rival-is-afk")
    .setLabel("Buscar nuevo oponente")
    .setStyle("DANGER")
);

const createArena = async (interaction, players) => {
  const playerDiscordId = players[0].id;
  const lobby = await lobbyAPI.getByPlayer(playerDiscordId);
  const guild = await lobbyAPI.getGuild(lobby.id);

  const discordGuild = await interaction.client.guilds.fetch(guild.discord_id);
  if (!discordGuild)
    throw { name: "NO_GUILD", args: { discordId: guild.discord_id } };
  const arenaCategory = discordGuild.channels.cache.find(
    (chan) => chan.type === "GUILD_CATEGORY" && chan.name === "ARENAS"
  );

  // Needs arena name
  const textPermission = players.map((player) => {
    return {
      id: player.id,
      allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES],
    };
  });

  const voicePermisssion = players.map((player) => {
    return {
      id: player.id,
      allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.CONNECT],
    };
  });

  const channel = await discordGuild.channels.create("arena", {
    type: "GUILD_TEXT",
    parent: arenaCategory.id,
    permissionOverwrites: [
      {
        id: discordGuild.id,
        deny: [Permissions.FLAGS.VIEW_CHANNEL],
      },
      ...textPermission,
    ],
  });

  const voiceChannel = await discordGuild.channels.create("arena", {
    type: "GUILD_VOICE",
    parent: arenaCategory.id,
    permissionOverwrites: [
      {
        id: discordGuild.id,
        deny: [Permissions.FLAGS.CONNECT],
      },
      ...voicePermisssion,
    ],
  });

  const firstMessageText = `¡Bienvenidos! Jugad, y cuando acabéis haced /ggs.`;
  await channel.send({
    content: firstMessageText,
  });

  return { text: channel, voice: voiceChannel };
};

const editDMs = async (channels, messages) => {
  const { text: textChannel, voice: voiceChannel } = channels;
  // DM messages
  let updatedText =
    `¡Hay partido! Dirígete a ${textChannel} y a pelear.\n` +
    `También podéis ir a ${voiceChannel} para disfrutar de un voice chat privado.`;

  for (message of messages) {
    await message.edit({
      content: updatedText,
      components: [],
    });
  }
};

const editTierMessages = async (interaction, tierMessages, players) => {
  // Update #tier messages
  if (tierMessages.length < 0) return;

  const guildId = tierMessages[0].guild_id;
  const guild = await interaction.client.guilds.fetch(guildId);

  const members = [];
  for (player of players) {
    const member = await guild.members.fetch(player.id);
    members.push(member);
  }

  const memberFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const memberNames = memberFormatter.format(
    members.map((member) => `**${member.displayName}**`)
  );

  updatedText = `${memberNames} están jugando.`;

  for (messageInfo of tierMessages) {
    const channel = await guild.channels.fetch(messageInfo.channel_id);
    const message = await channel.messages.fetch(messageInfo.message_id);

    await message.edit({
      content: updatedText,
      components: [],
    });
  }
};

const timeOutMessage = async (
  message,
  lobbyId,
  acceptedPlayerId,
  notAcceptedPlayerId
) => {
  await new Promise((r) => setTimeout(r, 5000));

  const isAfk = await lobbyAPI.timeOutCheck(
    lobbyId,
    acceptedPlayerId,
    notAcceptedPlayerId
  );

  if (isAfk)
    await message.edit({
      content: `Parece que tu rival no contesta... Cuando te canses de esperar, pulsa el botón para buscar un nuevo oponente.`,
      components: [timeoutButtons],
    });
};

const allAccepted = async (interaction, lobbyPlayers) => {
  const players = [];
  const messages = [];

  for (dm of lobbyPlayers) {
    const player = await interaction.client.users.fetch(dm.discord_id);
    const message = await player.dmChannel.messages.fetch(dm.message_id);
    players.push(player);
    messages.push(message);
  }

  const channels = await createArena(interaction, players);
  const { messages: tierMessages } = await lobbyAPI.afterConfirmation(
    interaction.user.id,
    channels.text.id,
    channels.voice.id
  );

  await editDMs(channels, messages);
  await editTierMessages(interaction, tierMessages, players);
};

const notAllAccepted = async (interaction, notAcceptedPlayers) => {
  // If there's someone who hasn't accepted yet, disable buttons
  // and edit the message
  // Launch timeout button promise
  const notAcceptedPlayersNames = [];
  for (playerInfo of notAcceptedPlayers) {
    const player = await interaction.client.users.fetch(playerInfo.discord_id);
    notAcceptedPlayersNames.push(`**${player.username}**`);
  }
  const missingNames = notAcceptedPlayersNames.join(", ");

  await interaction.update({
    content: `Has aceptado, pero todavía falta que acepte ${missingNames}.`,
    components: [row],
  });

  timeOutMessage(
    interaction.message,
    notAcceptedPlayers[0].lobby_id,
    interaction.user.id,
    notAcceptedPlayers[0].discord_id
  );
};

const execute = async (interaction) => {
  const playerDiscordId = interaction.user.id;
  const lobbyPlayers = await lobbyAPI.acceptMatch(playerDiscordId);
  const notAcceptedPlayers = lobbyPlayers.filter(
    (player) => player.status !== "ACCEPTED"
  );

  if (notAcceptedPlayers.length > 0) {
    await notAllAccepted(interaction, notAcceptedPlayers);
  } else {
    await allAccepted(interaction, lobbyPlayers);
  }
};

module.exports = {
  data: { name: "accept-confirmation" },
  execute,
};
