const { CustomError } = require("../errors/customError");
const winston = require("winston");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    let command = null;
    if (interaction.isCommand()) command = interaction.client.commands.get(interaction.commandName);
    else if (interaction.isButton()) {
      command = interaction.client.buttons.get(interaction.customId);
      if (!command && interaction.customId.startsWith("play-character"))
        command = interaction.client.buttons.get("play-character");
      if (!command && interaction.customId.startsWith("ban-stage"))
        command = interaction.client.buttons.get("ban-stage");
      if (!command && interaction.customId.startsWith("game-winner"))
        command = interaction.client.buttons.get("game-winner");
      if (!command && interaction.customId.startsWith("pick-stage"))
        command = interaction.client.buttons.get("pick-stage");
      if (!command && interaction.customId.startsWith("register-tier"))
        command = interaction.client.buttons.get("register-tier");
    }

    if (!command) {
      winston.error("Comando inválido: " + interaction.customId);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error.stack);

      let content;
      const ephemeral = true;

      if (error instanceof CustomError) {
        content = error.message;
      } else content = "Ha habido un error inesperado. Habla con un admin para que mire los logs.";

      winston.error(content);
      winston.debug(error.stack);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral });
      } else await interaction.reply({ content, ephemeral });
    }
  },
};
