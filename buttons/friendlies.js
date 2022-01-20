const { MessageActionRow, MessageButton } = require("discord.js");

const lobbyDB = require("../db/lobby");
const playerDB = require("../db/player");
const tierDB = require("../db/tier");
const guildDB = require("../db/guild");

const lobbyAPI = require("../api/lobby");

EXCEPTION_MESSAGES = {
  GUILD_NOT_FOUND: `__**ERROR**__: No se ha encontrado el servidor.`,
  PLAYER_NOT_FOUND: `__**ERROR**__: No se ha encontrado al jugador.`,
  TIER_NOT_FOUND: `__**ERROR**__: No se ha encontrado la tier.`,
  NOT_SEARCHING:
    `No puedes buscar partida porque ya has encontrado una.` +
    `Espera a que tu rival confirme, o cierra la arena si ya habéis terminado de jugar.`,
  LOBBY_NOT_FOUND: `__**ERROR**__: No se ha encontrado el lobby.`,
  MESSAGES_NOT_FOUND: `__**ERROR**__: No se han encontrado mensajes.`,
  TOO_MANY_PLAYERS: `__**ERROR**__: Aún no están listas las arenas de más de 2 players.`,
};

const exceptionHandler = async (interaction, exception) => {
  const { name, args } = exception;

  // Get message
  let response = EXCEPTION_MESSAGES[name];
  if (!response)
    switch (name) {
      case "TOO_NOOB":
        const targetTier = await interaction.guild.roles.fetch(args.targetTier);
        const playerTier = await interaction.guild.roles.fetch(args.playerTier);
        response = `¡No puedes jugar en ${targetTier} siendo ${playerTier}!`;
        break;

      case "ALREADY_SEARCHING":
        const targetTier = await interaction.guild.roles.fetch(args.targetTier);
        response = `Ya estabas buscando en ${targetTier}!`;
        break;
    }

  if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

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
      .setCustomId("cancel-confirmation")
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

const matched = async (interaction, playerIdList) => {
  // Actions to do after a match has been found
  // This includes :
  //   - sending the confirmation DMs
  //   - editing existing #tier-X messages

  // Get players
  const players = [];
  for (playerDiscordId in playerIdList) {
    const player = await interaction.guild.members.fetch(playerDiscordId);
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
  const playerId = interaction.user.id;
  const messages = await lobbyAPI.getTierMessages(playerId);

  for (message of messages) {
    const { messageId, channelId } = message;
    const channel = await interaction.guild.channels.fetch(channelId);
    const message = await channel.fetch(messageId);

    await message.edit({
      content: `¡**${interaction.member.displayName}** ha encontrado partida! Veamos si aceptan todos...`,
    });
  }

  return await interaction.reply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
};

const notMatched = async (interaction, tierId, channelId) => {
  // Actions to do after not finding a match
  // This includes sending a message to #tier
  const playerId = interaction.user.id;
  const tierRole = await interaction.guild.roles.fetch(tierId);

  if (channelId) {
    const channel = await interaction.guild.channels.fetch(channelId);

    const message = await channel.send({
      content:
        `Atención ${tierRole}: **${interaction.member.displayName}**` +
        ` está buscando partida en **${tierRole.name}`,
    });

    await lobbyAPI.saveSearchTierMessage(playerId, tierId, message.id);
  }

  return await interaction.reply({
    content: `A partir de ahora estás buscando en ${tierRole}`,
    ephemeral: true,
  });
};

const execute = async (interaction) => {
  const guildId = interaction.guild.id;
  const playerId = interaction.user.id;
  const messageId = interaction.message.id;

  try {
    const searchResult = await lobbyAPI.search(playerId, guildId, messageId);
    if (searchResult.matched) {
      await matched(interaction, searchResult.players);
    } else {
      const { tierId, channelId } = searchResult;
      await notMatched(interaction, tierId, channelId);
    }
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data: { name: "friendlies" },
  execute,
};
