const { SlashCommandBuilder } = require("@discordjs/builders");
const discordRolesUtils = require("../utils/discordRoles");

const data = new SlashCommandBuilder()
  .setName("second")
  .setDescription("Selecciona tu second")
  .addStringOption((option) =>
    option
      .setName("character")
      .setDescription("El personaje que pondrás como second")
      .setRequired(true)
  );

module.exports = {
  data: data,
  async execute(interaction) {
    await discordRolesUtils.assignRole(
      interaction,
      interaction.options.getString("character"),
      "SECOND"
    );
  },
};
