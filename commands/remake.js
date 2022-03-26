const { SlashCommandBuilder } = require("@discordjs/builders");
const setAPI = require("../api/gameSet");
const { setupNextGame } = require("../utils/discordGameset");

const data = new SlashCommandBuilder()
  .setName("remake")
  .setDescription("Vuelve a empezar el game en curso. Usadlo solo si se queda bloqueado el bot.");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    NO_LOBBY: "El comando /remake tiene que ser usado en el canal de la arena donde estás jugando.",
    NO_GAMESET: "¡No estás jugando ningún set! No hay nada a remakear si no estás jugando.",
    NO_GAME: "¡No hay ningún game en curso! ",
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
  const channel = interaction.channel;

  try {
    await setAPI.removeCurrentGame(channel.id);
    await interaction.reply("¡Corten! ¡Repetimos!");
    await setupNextGame(interaction);
  } catch (e) {
    await exceptionHandler(interaction, e);
  }
};

module.exports = {
  data,
  execute,
};
