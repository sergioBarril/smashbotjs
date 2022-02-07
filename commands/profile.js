const { SlashCommandBuilder } = require("@discordjs/builders");
const discordRolesUtils = require("../utils/discordRoles");

const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Visualiza tu perfil");

module.exports = {
  data: data,
  async execute(interaction) {
    await interaction.reply({
      content: `WIP. Aquí verás tu perfil `,
      ephemeral: true,
    });
  },
};
