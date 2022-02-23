const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    GUILD_NOT_FOUND: `__**ERROR**__: No se ha encontrado el servidor.`,
    PLAYER_NOT_FOUND: `__**ERROR**__: No se ha encontrado al jugador.`,
    TIER_NOT_FOUND: `__**ERROR**__: No se ha encontrado la tier.`,
    NO_RIVAL_LOBBY: `Tu rival no está buscando partida o ya está jugando.`,
    RIVAL_NOT_SEARCHING: `Tu rival no está buscando partida.`,
    SAME_PLAYER: `Oye, que esta es **TU** partida. Ya aparecerá alguien para jugarte...`,
    ALREADY_PLAYING: `Ya estás jugando otra partida. Si has acabado, cierra la sala con /ggs`,
    IN_CONFIRMATION: `Ya has encontrado otra partida. Acéptala y juégala, o recházala y vuelve a pulsar el botón.`,
    YUZU_INCOMPATIBLE: `No eres compatible con este jugador. Ambos tenéis el mismo rol (host o cliente).`,
    NO_YUZU_PLAYER: `Uno de los dos no tiene el Yuzu Player configurado.`,
    MESSAGES_NOT_FOUND: `__**ERROR**__: No se han encontrado mensajes.`,
    TOO_MANY_PLAYERS: `__**ERROR**__: Aún no están listas las arenas de más de 2 players.`,
  };

  const { name, args } = exception;

  // Get message
  const response = EXCEPTION_MESSAGES[name];

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

const execute = async (interaction) => {
  const guildId = interaction.guild.id;
  const playerId = interaction.user.id;
  const messageId = interaction.message.id;
  const channelId = interaction.message.channel.id;

  try {
    const searchResult = await lobbyAPI.directMatch(
      playerId,
      guildId,
      messageId,
      channelId
    );
    await matched(interaction, searchResult.players);
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data: { name: "direct-match" },
  execute,
};
