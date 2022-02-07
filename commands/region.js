const { SlashCommandBuilder } = require("@discordjs/builders");

const data = new SlashCommandBuilder()
  .setName("region")
  .setDescription("Selecciona tu región")
  .addStringOption((option) =>
    option.setName("region").setDescription("La región que te asignarás")
  );

module.exports = {
  data: data,
  async execute(interaction) {
    await interaction.reply({
      content: `Has escogido: ${interaction.options.getString("region")}`,
      ephemeral: true,
    });
  },
};
