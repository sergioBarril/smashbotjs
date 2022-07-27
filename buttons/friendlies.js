const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");

const exceptionHandler = async (interaction, exception) => {
  // EXCEPTION_MESSAGES = {
  //   GUILD_NOT_FOUND: `__**ERROR**__: No se ha encontrado el servidor.`,
  //   PLAYER_NOT_FOUND: `__**ERROR**__: No se ha encontrado al jugador.`,
  //   TIER_NOT_FOUND: `__**ERROR**__: No se ha encontrado la tier.`,
  //   NOT_SEARCHING:
  //     `No puedes buscar partida porque ya has encontrado una.\n` +
  //     `Espera a que tu rival confirme, o cierra la arena si ya habéis terminado de jugar.`,
  //   LOBBY_NOT_FOUND: `__**ERROR**__: No se ha encontrado el lobby.`,
  //   MESSAGES_NOT_FOUND: `__**ERROR**__: No se han encontrado mensajes.`,
  //   TOO_MANY_PLAYERS: `__**ERROR**__: Aún no están listas las arenas de más de 2 players.`,
  //   NO_CABLE: `¡No tienes ninguna tier asignada! No puedes buscar partida aquí.`,
  // };

  // const { name, args } = exception;

  // // Get message
  // let response = EXCEPTION_MESSAGES[name];
  // if (!response)
  //   switch (name) {
  //     case "TOO_NOOB": {
  //       const targetTier = await interaction.guild.roles.fetch(args.targetTier);
  //       const playerTier = await interaction.guild.roles.fetch(args.playerTier);
  //       response = `¡No puedes jugar en ${targetTier} siendo ${playerTier}!`;
  //       break;
  //     }
  //     case "NO_YUZU": {
  //       const yuzuRole = await interaction.guild.roles.fetch(args.yuzuRole);
  //       const parsecRole = await interaction.guild.roles.fetch(args.parsecRole);
  //       response = `¡No puedes jugar Yuzu sin los roles de ${yuzuRole} o ${parsecRole}!`;
  //       break;
  //     }
  //     case "ALREADY_SEARCHING": {
  //       if (args.isYuzu) response = `¡Ya estabas buscando en **Yuzu**!`;
  //       else {
  //         const targetTier = await interaction.guild.roles.fetch(args.targetTiers[0].discord_id);
  //         response = `Ya estabas buscando en ${targetTier}!`;
  //       }
  //       break;
  //     }
  //   }

  // if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: exception.message,
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

const notMatched = async (interaction, tiers) => {
  // Actions to do after not finding a match
  // This includes sending a message to #tier
  const playerId = interaction.user.id;
  const guild = interaction.guild;

  let roles = [];

  for (let tier of tiers) {
    await discordMatchingUtils.notMatched(playerId, guild, tier);
    const tierRole = await guild.roles.fetch(tier.roleId);
    if (tier.yuzu) roles.push("**Yuzu**");
    else roles.push(`${tierRole}`);
  }

  const rolesFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const rolesNames = rolesFormatter.format(roles);

  return await interaction.reply({
    content: `A partir de ahora estás buscando en ${rolesNames}`,
    ephemeral: true,
  });
};

const execute = async (interaction) => {
  const guildId = interaction.guild.id;
  const playerId = interaction.user.id;
  const messageId = interaction.customId === "friendlies" ? interaction.message.id : null;

  try {
    const searchResult = await lobbyAPI.search(playerId, guildId, messageId);
    if (searchResult.matched) {
      await matched(interaction, searchResult.players);
    } else {
      const { tiers, isYuzu } = searchResult;
      await notMatched(interaction, tiers, isYuzu);
    }
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data: { name: "friendlies" },
  execute,
};
