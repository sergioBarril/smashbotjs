const lobbyAPI = require("../api/lobby");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    NOT_PLAYING: "¡No estás jugando! No hay ninguna arena por cerrar.",
    IN_GAMESET: "¡Estás jugando un set! Tenéis que acabarlo o cancelarlo antes de cerrar el lobby.",
  };
  const { name } = exception;

  // Get message
  let response = EXCEPTION_MESSAGES[name];
  if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

const deleteDirectMessages = async (guild, players) => {
  const playerNames = [];

  for (player of players) {
    const member = await guild.members.fetch(player.discord_id);
    const dmChannel = await member.user.createDM();
    const message = await dmChannel.messages.fetch(player.message_id);
    message.delete();
    playerNames.push(member.displayName);
  }

  return playerNames;
};

const editTierMessages = async (guild, messages, playerNames) => {
  const memberFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const playerString = memberFormatter.format(playerNames.map((name) => `**${name}**`));

  const timestamp = new Date();

  for (messageInfo of messages) {
    const channel = await guild.channels.fetch(messageInfo.channel_id);
    const message = await channel.messages.fetch(messageInfo.message_id);

    const hours = timestamp.getHours();
    const minutes = timestamp.getMinutes();

    const hoursText = String(hours).padStart(2, "0");
    const minutesText = String(minutes).padStart(2, "0");

    message.edit({
      content: `${playerString} han terminado de jugar a las ${hoursText}:${minutesText}`,
      components: [],
    });
  }
};

const channelsRemoval = async (guild, lobby) => {
  const textChannel = await guild.channels.fetch(lobby.text_channel_id);
  const voiceChannel = await guild.channels.fetch(lobby.voice_channel_id);

  await new Promise((r) => setTimeout(r, 5000));

  textChannel.delete();
  voiceChannel.delete();
};

const cancelLobby = async (interaction) => {
  try {
    const player = interaction.user;
    const lobbyPlayers = await lobbyAPI.getPlayingPlayers(player.id);
    const messages = await lobbyAPI.getMessages(player.id);
    const lobby = await lobbyAPI.closeArena(player.id);
    const guild = await interaction.client.guilds.fetch(lobby.guild_id);

    channelsRemoval(guild, lobby);

    const playerNames = await deleteDirectMessages(guild, lobbyPlayers);
    await editTierMessages(guild, messages, playerNames);

    await interaction.reply({
      content: "GGs, ¡gracias por jugar!",
    });
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  cancelLobby,
};
