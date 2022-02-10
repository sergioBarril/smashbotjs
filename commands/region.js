const { SlashCommandBuilder } = require("@discordjs/builders");
const { assignRole } = require("../utils/discordRoles");

const data = new SlashCommandBuilder()
  .setName("region")
  .setDescription("Selecciona tu región")
  .addStringOption((option) =>
    option
      .setName("region")
      .setDescription("La región que te asignarás")
      .setRequired(true)
  );

module.exports = {
  data: data,
  async execute(interaction) {
    await assignRole(
      interaction,
      interaction.options.getString("region"),
      "REGION"
    );
  },
};
