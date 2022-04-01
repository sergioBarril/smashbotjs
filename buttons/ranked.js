const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");
const guildAPI = require("../api/guild");
const ratingAPI = require("../api/rating");
const { MessageActionRow, MessageButton } = require("discord.js");

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
    NO_CABLE: `¡No tienes ninguna tier asignada! No puedes buscar partida aquí.`,
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
      case "NO_YUZU": {
        const yuzuRole = await interaction.guild.roles.fetch(args.yuzuRole);
        const parsecRole = await interaction.guild.roles.fetch(args.parsecRole);
        response = `¡No puedes jugar Yuzu sin los roles de ${yuzuRole} o ${parsecRole}!`;
        break;
      }
      case "ALREADY_SEARCHING": {
        if (args.isYuzu) response = `¡Ya estabas buscando en **Yuzu**!`;
        else {
          const targetTier = await interaction.guild.roles.fetch(args.targetTiers[0].discord_id);
          response = `Ya estabas buscando en ${targetTier}!`;
        }
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

const sendChannelMessage = async (playerId, guild) => {
  // Actions to do after not finding a match
  // This includes sending a message to #tier

  const button = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("direct-match-ranked").setLabel("Ranked").setStyle("SUCCESS")
  );

  const member = await guild.members.fetch(playerId);
  const { mains, seconds } = await rolesAPI.getCharacters(playerId, guild.id);

  const characters = mains.concat(seconds);

  let charsText = "";
  if (characters.length > 0) {
    const charsEmojis = characters.map((char) => smashCharacters[char.name].emoji);
    charsText = ` (${charsEmojis.join("")})`;
  }

  const channelId = await guildAPI.getRankedChannel(guild.id);
  const rankedRoleId = await ratingAPI.getRankedRole(playerId, guild.id);

  const channel = await guild.channels.fetch(channelId);
  const rankedRole = await guild.roles.fetch(rankedRoleId);

  const messageContent =
    `${rankedRole} - **${member.displayName}**${charsText}` +
    ` está buscando partida en **RANKED**.`;

  const message = await channel.send({
    content: messageContent,
    components: [button],
  });

  await lobbyAPI.saveSearchTierMessage(playerId, rankedRoleId, message.id, false);
};

const notMatched = async (interaction, tiers) => {
  // Actions to do after not finding a match
  // This includes sending a message to #tier
  const playerId = interaction.user.id;
  const guild = interaction.guild;

  let roles = [];

  for (tier of tiers) {
    const tierInfo = { tier_id: tier.discord_id, channel_id: tier.channel_id, yuzu: tier.yuzu };

    await discordMatchingUtils.notMatched(playerId, guild, tierInfo);
    const tierRole = await guild.roles.fetch(tier.discord_id);
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

  try {
    await lobbyAPI.rankedSearch(playerId, guildId);
    await notMatched(interaction);
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data: { name: "friendlies" },
  execute,
};
