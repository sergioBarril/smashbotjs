const { SlashCommandBuilder } = require("@discordjs/builders");

const lobbyAPI = require("../api/lobby");

const data = new SlashCommandBuilder()
  .setName("ggs")
  .setDescription("Closes the current arena instantly");

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

module.exports = {
  data: data,
  async execute(interaction) {
    const player = interaction.user;

    try {
      const lobbyPlayers = await lobbyAPI.getPlayingPlayers(player.id);
      const messages = await lobbyAPI.getMessages(player.id);
      const lobby = await lobbyAPI.closeArena(player.id);

      const guild = await interaction.client.guilds.fetch(lobby.guild_id);
      const textChannel = await guild.channels.fetch(lobby.text_channel_id);
      const voiceChannel = await guild.channels.fetch(lobby.voice_channel_id);

      textChannel.delete();
      voiceChannel.delete();

      const playerNames = await deleteDirectMessages(guild, lobbyPlayers);
      await editTierMessages(guild, messages, playerNames);
    } catch (exc) {
      if (exc.name == "NOT_PLAYING")
        return await interaction.reply({
          content: "No estás jugando! Pero ggs a ti también.",
          ephemeral: true,
        });
      else throw exc;
    }

    await interaction.reply({
      content: "GGs.",
      ephemeral: true,
    });
  },
};
