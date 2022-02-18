const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    GUILD_NOT_FOUND: `__**ERROR**__: No se ha encontrado el servidor.`,
    PLAYER_NOT_FOUND: `__**ERROR**__: No se ha encontrado al jugador.`,
    TIER_NOT_FOUND: `__**ERROR**__: No se ha encontrado la tier.`,
    NOT_SEARCHING:
      `No puedes buscar partida porque ya has encontrado una.\n` +
      `Espera a que tu rival confirme, o cierra la arena si ya habéis terminado de jugar.`,
    LOBBY_NOT_FOUND: `__**ERROR**__: No se ha encontrado el lobby.`,
    MESSAGES_NOT_FOUND: `__**ERROR**__: No se han encontrado mensajes.`,
    TOO_MANY_PLAYERS: `__**ERROR**__: Aún no están listas las arenas de más de 2 players.`,
  };

  const { name, args } = exception;

  // Get message
  let response = EXCEPTION_MESSAGES[name];
  if (!response)
    switch (name) {
      case "TOO_NOOB": {
        const targetTier = await interaction.guild.roles.fetch(args.targetTier);
        const playerTier = await interaction.guild.roles.fetch(args.playerTier);
        response = `¡No puedes jugar en ${targetTier} siendo ${playerTier}!`;
        break;
      }
      case "ALREADY_SEARCHING": {
        const targetTier = await interaction.guild.roles.fetch(args.targetTier);
        response = `Ya estabas buscando en ${targetTier}!`;
        break;
      }
    }

  if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

const matched = async (interaction, playerIdList) => {
  const guild = interaction.guild;
  await discordMatchingUtils.matched(guild, playerIdList);

  return await interaction.reply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
};

const notMatched = async (interaction, tierId, channelId) => {
  // Actions to do after not finding a match
  // This includes sending a message to #tier
  const playerId = interaction.user.id;
  const guild = interaction.guild;
  const tierInfo = { tier_id: tierId, channel_id: channelId };

  await discordMatchingUtils.notMatched(playerId, guild, tierInfo);

  const tierRole = await guild.roles.fetch(tierId);

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
