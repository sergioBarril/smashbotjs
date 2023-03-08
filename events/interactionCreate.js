const { CustomError } = require("../errors/customError");
const winston = require("winston");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    let command = null;
    if (interaction.isCommand()) command = interaction.client.commands.get(interaction.commandName);
    else if (interaction.isButton()) {
      command = interaction.client.buttons.get(interaction.customId);
      if (!command) {
        if (interaction.customId.startsWith("play-character"))
          command = interaction.client.buttons.get("play-character");
        else if (interaction.customId.startsWith("ban-stage"))
          command = interaction.client.buttons.get("ban-stage");
        else if (interaction.customId.startsWith("game-winner"))
          command = interaction.client.buttons.get("game-winner");
        else if (interaction.customId.startsWith("pick-stage"))
          command = interaction.client.buttons.get("pick-stage");
        else if (interaction.customId.startsWith("register-tier"))
          command = interaction.client.buttons.get("register-tier");
        else if (interaction.customId.startsWith("accept-confirmation"))
          command = interaction.client.buttons.get("accept-confirmation");
        else if (interaction.customId.startsWith("rival-is-afk"))
          command = interaction.client.buttons.get("rival-is-afk");
        else if (interaction.customId.startsWith("decline-confirmation"))
          command = interaction.client.buttons.get("decline-confirmation");
        else if (interaction.customId.startsWith("historial"))
          command = interaction.client.buttons.get("historial");
        else if (interaction.customId.startsWith("leaderboard"))
          command = interaction.client.buttons.get("leaderboard");
      }
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
