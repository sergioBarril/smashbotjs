const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");

const exceptionHandler = async (interaction, exception) => {
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
