const { SlashCommandBuilder } = require("@discordjs/builders");
const discordRolesUtils = require("../utils/discordRoles");

const { upsert } = require("./admin/roles/upsert");

const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("[ADMIN] Roles de administración del servidor.")
  .addSubcommandGroup((rolesCommands) =>
    rolesCommands
      .setName("roles")
      .setDescription("Comandos relacionados con los roles")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("upsert")
          .setDescription("Insert or update roles")
          .addStringOption((option) =>
            option
              .setName("type")
              .setDescription("Type of roles to be imported")
              .setRequired(true)
              .setChoices([
                ["Characters", "CHARACTERS"],
                ["Regions", "REGIONS"],
              ])
          )
      )
  );

module.exports = {
  data: data,
  async execute(interaction) {
    // ROLES
    if (interaction.options.getSubcommandGroup() === "roles") {
      if (interaction.options.getSubcommand() === "upsert") {
        await upsert(interaction);
      }
    }
  },
};
