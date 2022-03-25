const { SlashCommandBuilder } = require("@discordjs/builders");
const setAPI = require("../api/gameSet");
const { setupNextGame } = require("../utils/discordGameset");

const data = new SlashCommandBuilder()
  .setName("surrender")
  .setDescription("Admite la derrota en el set en curso");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    NO_LOBBY:
      "El comando /surrender tiene que ser usado en el canal de la arena donde estás jugando.",
    NO_GAMESET: "¡No estás jugando ningún set! No te puedes rendir si no estás jugando.",
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

const execute = async (interaction) => {
  const player = interaction.user;
  const channel = interaction.channel;

  try {
    await setAPI.surrender(player.id, channel.id);
    await setupNextGame(interaction);
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data,
  execute,
};
