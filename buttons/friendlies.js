const discordMatchingUtils = require("../utils/discordMatching");

const lobbyAPI = require("../api/lobby");
const { CustomError } = require("../errors/customError");
const { Tier } = require("../models/tier");
const { Player } = require("../models/player");

const exceptionHandler = async (interaction, exception) => {
  let message = exception.message;

  if (!(exception instanceof CustomError)) {
    message = "Ha habido un error inesperado. Habla con un admin para que mire los logs.";
    console.error(exception, exception.stack);
  }

  await interaction.reply({
    content: message,
    ephemeral: true,
  });
};

/**
 * Actions to do after finding a match
 * This includes:
 *  - sending the confirmation DMs
 *  - editing existing #tier-X messages
 * @param {*} interaction
 * @param {Array<Player>} players
 */
const matched = async (interaction, players) => {
  const guild = interaction.guild;
  await discordMatchingUtils.matched(guild, players);

  await interaction.reply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
};

/**
 * Actions to do after not finding a match
 * This includes sending a message to #tier
 * @param {*} interaction discord.js event interaction
 * @param {Array<Tier>} tiers Tiers that have been added in this interaction
 */
const notMatched = async (interaction, tiers) => {
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

  await interaction.reply({
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
      await notMatched(interaction, searchResult.tiers);
    }
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data: { name: "friendlies" },
  execute,
};
