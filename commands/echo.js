const { SlashCommandBuilder } = require("@discordjs/builders");

const data = new SlashCommandBuilder()
  .setName("echo")
  .setDescription("Replies with your input!")
  .addStringOption((option) =>
    option
      .setName("input")
      .setDescription("The input to echo back")
      .setRequired(true)
  )
  .setDefaultPermission(false);

module.exports = {
  data: data,
  async execute(interaction) {
    await interaction.reply({
      content: interaction.options.getString("input"),
      ephemeral: true,
    });
  },
};
