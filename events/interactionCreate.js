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
    }

    if (!command) {
      console.log("Rip");
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error.stack);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  },
};
