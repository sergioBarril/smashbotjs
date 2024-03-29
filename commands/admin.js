const { SlashCommandBuilder } = require("@discordjs/builders");
const { channel } = require("./admin/roles/channel");
const { channel: rankedChannel } = require("./admin/ranked/channel");
const { setWinner } = require("./admin/ranked/setWinner");
const { channel: leaderboardChannel } = require("./admin/leaderboard/channel");

const { upsert } = require("./admin/roles/upsert");
const { add } = require("./admin/tiers/add");
const { matchmaking } = require("./admin/tiers/matchmaking");
const { update } = require("./admin/leaderboard/update");
const { message } = require("./admin/welcome/message");
const { message: nodmMessage } = require("./admin/no-dm/message");
const { setTier } = require("./admin/rating/setTier");
const { setScore } = require("./admin/rating/setScore");
const { addScore } = require("./admin/rating/addScore");
const { setPromotion } = require("./admin/rating/setPromotion");
const { deleteLobbies } = require("./admin/bug/deleteLobbies");
const { cancelSet } = require("./admin/ranked/cancelSet");
const { setSmashHour } = require("./admin/ranked/smashHour");

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
              .addChoices(
                { name: "Characters", value: "CHARACTERS" },
                { name: "Regions", value: "REGIONS" }
              )
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
      .addSubcommand((subcommand) =>
        subcommand
          .setName("setwinner")
          .setDescription("Decide el ganador del set.")
          .addUserOption((option) =>
            option
              .setName("player")
              .setDescription("Jugador que se marcará como ganador del set")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("cancelset").setDescription("Cancela el set en juego en este canal")
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("smashhour")
          .setDescription("Modifica los parámetros de la Smash Hour")
          .addBooleanOption((option) =>
            option
              .setName("smashhour")
              .setRequired(true)
              .setDescription("True si está la smash hour activa, false si no.")
          )
          .addIntegerOption((option) =>
            option
              .setName("start")
              .setDescription("Hora (en formato 24h) a la que empieza la Smash Hour")
              .setRequired(false)
          )
          .addIntegerOption((option) =>
            option
              .setName("end")
              .setDescription("Hora (en formato 24h) a la que acaba la Smash Hour")
              .setRequired(false)
          )
      )
  )
  .addSubcommandGroup((leaderboardCommandGroup) =>
    leaderboardCommandGroup
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
  )
  .addSubcommandGroup((ratingCommandGroup) =>
    ratingCommandGroup
      .setName("rating")
      .setDescription("Comandos de admin relacionados con tiers, ranked y puntuaciones")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("tier")
          .setDescription("Asigna tier a un jugador")
          .addUserOption((option) =>
            option
              .setName("player")
              .setDescription("Persona a quien asignar la tier")
              .setRequired(true)
          )
          .addRoleOption((option) =>
            option.setName("tier").setDescription("Rol de la tier a asignar").setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("score")
          .setDescription("Asigna una score a un jugador")
          .addUserOption((option) =>
            option
              .setName("player")
              .setDescription("Persona a quien asignar la puntuación")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option.setName("score").setDescription("Nueva puntuación").setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("addscore")
          .setDescription("Añade score a un jugador")
          .addUserOption((option) =>
            option
              .setName("player")
              .setDescription("Persona a quien asignar la puntuación")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option.setName("score").setDescription("Puntuación a añadir").setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("promotion")
          .setDescription("Configura la promoción de un jugador")
          .addUserOption((option) =>
            option
              .setName("player")
              .setDescription("Persona a quien asignar la puntuación")
              .setRequired(true)
          )
          .addBooleanOption((option) =>
            option.setName("promotion").setDescription("¿Está en promoción?").setRequired(true)
          )
          .addIntegerOption((option) =>
            option.setName("wins").setDescription("Promotion wins").setRequired(false)
          )
          .addIntegerOption((option) =>
            option.setName("losses").setDescription("Promotion losses").setRequired(false)
          )
      )
  )
  .addSubcommandGroup((bugCommandGroup) =>
    bugCommandGroup
      .setName("bug")
      .setDescription("Comandos de admin relacionados con arreglar bugs y desbloquear el bot")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("deletelobbies")
          .setDescription("Borra lobbies en un estado, de un jugador o de todos")
          .addStringOption((option) =>
            option
              .setName("type")
              .setDescription("Tipo de lobby a eliminar")
              .setRequired(true)
              .addChoices(
                { name: "Searching", value: "SEARCHING" },
                { name: "Waiting", value: "WAITING" },
                { name: "Confirmation", value: "CONFIRMATION" },
                { name: "Playing", value: "PLAYING" },
                { name: "AFK", value: "AFK" }
              )
          )
          .addUserOption((option) =>
            option
              .setName("player")
              .setDescription(
                "Jugador del que eliminar el lobby. Si se deja vacío, se elimina de todos los jugadores"
              )
              .setRequired(false)
          )
      )
  )
  .addSubcommandGroup((noDmGroup) =>
    noDmGroup
      .setName("no-dm")
      .setDescription("Comandos de admin relacionados con la gente sin DM abiertos")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("message")
          .setDescription("Obtén el mensaje del canal de desasignarse el rol")
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
      if (interaction.options.getSubcommand() === "setwinner") await setWinner(interaction);
      if (interaction.options.getSubcommand() === "cancelset") await cancelSet(interaction);
      if (interaction.options.getSubcommand() === "smashhour") await setSmashHour(interaction);
    }

    if (interaction.options.getSubcommandGroup() === "welcome") {
      if (interaction.options.getSubcommand() === "message") await message(interaction);
    }

    if (interaction.options.getSubcommandGroup() === "leaderboard") {
      if (interaction.options.getSubcommand() === "channel") await leaderboardChannel(interaction);
      else if (interaction.options.getSubcommand() === "update") await update(interaction);
    }

    if (interaction.options.getSubcommandGroup() === "rating") {
      if (interaction.options.getSubcommand() === "tier") await setTier(interaction);
      else if (interaction.options.getSubcommand() === "score") await setScore(interaction);
      else if (interaction.options.getSubcommand() === "addscore") await addScore(interaction);
      else if (interaction.options.getSubcommand() === "promotion") await setPromotion(interaction);
    }

    if (interaction.options.getSubcommandGroup() === "no-dm") {
      if (interaction.options.getSubcommand() === "message") await nodmMessage(interaction);
    }

    if (interaction.options.getSubcommandGroup() === "bug") {
      if (interaction.options.getSubcommand() === "deletelobbies") await deleteLobbies(interaction);
    }
  },
};
