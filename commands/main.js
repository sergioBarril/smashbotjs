const { SlashCommandBuilder } = require("@discordjs/builders");
const discordRolesUtils = require("../utils/discordRoles");

const data = new SlashCommandBuilder()
  .setName("main")
  .setDescription("Selecciona tu main")
  .addStringOption((option) =>
    option
      .setName("character")
      .setDescription("El personaje que pondrás como main")
  );

module.exports = {
  data: data,
  async execute(interaction) {
    await discordRolesUtils.assignRole(
      interaction,
      interaction.options.getString("character"),
      "MAIN"
    );
  },
};
