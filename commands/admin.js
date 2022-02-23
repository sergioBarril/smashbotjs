const { SlashCommandBuilder } = require("@discordjs/builders");
const discordRolesUtils = require("../utils/discordRoles");

const { upsert } = require("./admin/roles/upsert");
const { add } = require("./admin/tiers/add");
const { matchmaking } = require("./admin/tiers/matchmaking");

const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("[ADMIN] Roles de administración del servidor.")
  .addSubcommandGroup((rolesCommandGroup) =>
    rolesCommandGroup
      .setName("roles")
      .setDescription("Comandos relacionados con los roles")
      // Upsert
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
  )
  .addSubcommandGroup((tierCommandGroup) =>
    tierCommandGroup
      .setName("tiers")
      .setDescription("Comandos relacionados con las tiers")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("Add a tier or pseudo-tier role")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the tier")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("weight")
              .setDescription(
                "Weight of the tier. The lower, the better (Tier 1 > Tier 2)."
              )
          )
          .addIntegerOption((option) =>
            option
              .setName("threshold")
              .setDescription("Starting points for this tier.")
              .setMinValue(0)
          )
          .addStringOption((option) =>
            option.setName("color").setDescription("Color of the tier role")
          )
          .addBooleanOption((option) =>
            option.setName("yuzu").setDescription("Is this a tier for yuzu?")
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("matchmaking")
          .setDescription("Remakes the search channel.")
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
    if (interaction.options.getSubcommandGroup() === "tiers") {
      if (interaction.options.getSubcommand() === "add") {
        await add(interaction);
      }
      if (interaction.options.getSubcommand() === "matchmaking") {
        await matchmaking(interaction);
      }
    }
  },
};
