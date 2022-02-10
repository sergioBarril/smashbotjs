const { SlashCommandBuilder } = require("@discordjs/builders");
const discordRolesUtils = require("../utils/discordRoles");

const data = new SlashCommandBuilder()
  .setName("pocket")
  .setDescription("Selecciona tu pocket")
  .addStringOption((option) =>
    option
      .setName("character")
      .setDescription("El personaje que pondrás como pocket")
      .setRequired(true)
  );

module.exports = {
  data: data,
  async execute(interaction) {
    await discordRolesUtils.assignRole(
      interaction,
      interaction.options.getString("character"),
      "POCKET"
    );
  },
};
