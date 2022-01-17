const lobbyDB = require("../db/lobby");
const guildDB = require("../db/guild");

const { MessageActionRow, MessageButton, Permissions } = require("discord.js");

const createArena = async (interaction, players) => {
  const playerDiscordId = players[0].id;
  const lobby = await lobbyDB.getConfirmationLobbyByPlayer(
    playerDiscordId,
    true
  );
  const guild = await guildDB.getByLobby(lobby.id);

  const discordGuild = await interaction.client.guilds.fetch(guild.discord_id);

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
    permissionOverwrites: [
      {
        id: discordGuild.id,
        deny: [Permissions.FLAGS.CONNECT],
      },
      ...voicePermisssion,
    ],
  });

  await lobbyDB.updateLobbyChannels(lobby.id, channel.id, voiceChannel.id);
  await lobbyDB.removeOtherLobbies(lobby.id);
  await lobbyDB.updateStatus(lobby.id, "PLAYING");

  const firstMessageText = `¡Bienvenidos! Jugad, y cuando acabéis haced /ggs.`;
  await channel.send({
    content: firstMessageText,
  });

  return { text: channel, voice: voiceChannel };
};

module.exports = {
  data: { name: "accept-confirmation" },
  async execute(interaction) {
    const notAcceptedPlayers = await lobbyDB.acceptMatch(interaction.user.id);

    // Someone rejected while this was processing
    if (notAcceptedPlayers == null) {
      return await interaction.reply({
        content: `Ha habido algún problema creo...`,
        ephemeral: true,
      });
    }

    // Disable buttons
    const row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("accept-confirmation")
        .setLabel("Aceptar")
        .setStyle("SUCCESS")
        .setDisabled(),
      new MessageButton()
        .setCustomId("cancel-confirmation")
        .setLabel("Rechazar")
        .setStyle("DANGER")
        .setDisabled()
    );

    let updatedText = "";

    if (notAcceptedPlayers.length > 0) {
      // Get names of players left to accept
      const notAcceptedPlayersNames = [];
      for (playerDiscordId of notAcceptedPlayers) {
        const player = await interaction.client.users.fetch(playerDiscordId);
        notAcceptedPlayersNames.push(`**${player.username}**`);
      }
      const missingNames = notAcceptedPlayersNames.join(", ");
      updatedText = `Has aceptado, pero todavía falta que acepte ${missingNames}.`;

      await interaction.update({
        content: updatedText,
        components: [row],
      });
    } else {
      const dmList = await lobbyDB.getConfirmationDM(interaction.user.id, true);

      const players = [];
      const messages = [];

      for (dm of dmList) {
        const player = await interaction.client.users.fetch(dm.discord_id);
        const message = await player.dmChannel.messages.fetch(dm.message_id);
        players.push(player);
        messages.push(message);
      }

      const channels = await createArena(interaction, players);
      const { text: textChannel, voice: voiceChannel } = channels;

      updatedText =
        `¡Hay partido! Dirígete a ${textChannel} y a pelear.\n` +
        `También podéis ir a ${voiceChannel} para disfrutar de un voice chat privado.`;

      for (message of messages) {
        await message.edit({
          content: updatedText,
          components: [],
        });
      }

      return await interaction.update({
        content: updatedText,
        components: [],
      });
    }
  },
};
