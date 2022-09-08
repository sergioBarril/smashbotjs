const { SlashCommandBuilder } = require("@discordjs/builders");
const discordRolesUtils = require("../utils/discordRoles");
const { channel } = require("./admin/roles/channel");
const { channel: rankedChannel } = require("./admin/ranked/channel");
const { channel: leaderboardChannel } = require("./admin/leaderboard/channel");

const { upsert } = require("./admin/roles/upsert");
const { add } = require("./admin/tiers/add");
const { matchmaking } = require("./admin/tiers/matchmaking");
const { update } = require("./admin/leaderboard/update");
const { message } = require("./admin/welcome/message");

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
      .addSubcommand((subcommand) =>
        subcommand.setName("channel").setDescription("Remake the roles channel")
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
            option.setName("name").setDescription("Name of the tier").setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("weight")
              .setDescription("Weight of the tier. The lower, the better (Tier 1 > Tier 2).")
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
        subcommand.setName("matchmaking").setDescription("Remakes the search channel.")
      )
  )
  .addSubcommandGroup((rankedCommandGroup) =>
    rankedCommandGroup
      .setName("ranked")
      .setDescription("Comandos de admin relacionados con las ranked")
      .addSubcommand((subcommand) =>
        subcommand.setName("channel").setDescription("Crea el canal de rankeds")
      )
  )
  .addSubcommandGroup((rankedCommandGroup) =>
    rankedCommandGroup
      .setName("leaderboard")
      .setDescription("Comandos de admin relacionados con las leaderboards")
      .addSubcommand((subcommand) =>
        subcommand.setName("channel").setDescription("Crea el canal #leaderboards")
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("update").setDescription("Actualiza el canal #leaderboards")
      )
  )
  .addSubcommandGroup((welcomeCommandGroup) =>
    welcomeCommandGroup
      .setName("welcome")
      .setDescription("Comandos de admin relacionados con el canal de bienvenida")
      .addSubcommand((subcommand) =>
        subcommand.setName("message").setDescription("Crea el mensaje de bienvenida en este canal")
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
      if (interaction.options.getSubcommand() === "channel") {
        await channel(interaction);
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
    if (interaction.options.getSubcommandGroup() === "ranked") {
      if (interaction.options.getSubcommand() === "channel") await rankedChannel(interaction);
    }

    if (interaction.options.getSubcommandGroup() === "welcome") {
      if (interaction.options.getSubcommand() === "message") await message(interaction);
    }

    if (interaction.options.getSubcommandGroup() === "leaderboard") {
      if (interaction.options.getSubcommand() === "channel") await leaderboardChannel(interaction);
      else if (interaction.options.getSubcommand() === "update") await update(interaction);
    }
  },
};
