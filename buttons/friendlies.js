const { MessageActionRow, MessageButton } = require("discord.js");

const lobbyDB = require("../db/lobby");
const playerDB = require("../db/player");
const tierDB = require("../db/tier");
const guildDB = require("../db/guild");

const canSearchTier = (playerTier, targetTier) => {
  if (!playerTier || !targetTier) return false;
  return targetTier.weight == null || targetTier.weight >= playerTier.weight;
};

const sendConfirmation = async (player, player2) => {
  const messageText = `¡Match encontrado! ${player}, te toca contra **${player2.displayName}**`;
  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("accept-confirmation")
      .setLabel("Aceptar")
      .setStyle("SUCCESS"),
    new MessageButton()
      .setCustomId("cancel-confirmation")
      .setLabel("Rechazar")
      .setStyle("DANGER")
  );
  const message = await player.send({
    content: messageText,
    components: [row],
  });

  await lobbyDB.setConfirmationDM(player.id, message.id, true);
};

const matchmaking = async (interaction, playerId, lobbyId, tierId) => {
  const matchmakingResult = await lobbyDB.matchmaking(
    playerId,
    lobbyId,
    tierId
  );

  if (!matchmakingResult) {
    // @Tier in #tier-X
    return false;
  }

  const player = await interaction.guild.members.fetch(
    matchmakingResult.playerDiscordId
  );
  const rivalPlayer = await interaction.guild.members.fetch(
    matchmakingResult.rivalPlayerDiscordId
  );

  await Promise.all([
    sendConfirmation(player, rivalPlayer),
    sendConfirmation(rivalPlayer, player),
  ]);

  await interaction.reply({
    content: "¡Te he encontrado rival! Mira tus MDs.",
    ephemeral: true,
  });
  return true;
};

module.exports = {
  data: { name: "friendlies" },
  async execute(interaction) {
    const guildDiscordId = interaction.guild.id;
    const playerDiscordId = interaction.user.id;
    const messageDiscordId = interaction.message.id;

    const guild = await guildDB.get(guildDiscordId, true);
    if (!guild)
      return await interaction.reply({
        content: `No se ha encontrado el servidor.`,
        ephemeral: true,
      });

    const player = await playerDB.get(playerDiscordId, true);
    if (!player)
      return await interaction.reply({
        content: `No se ha encontrado tu ficha de jugador.`,
        ephemeral: true,
      });

    const targetTier = await tierDB.getByMessage(messageDiscordId);
    if (!targetTier)
      return await interaction.reply({
        content: `No se ha encontrado la tier.`,
        ephemeral: true,
      });

    const playerTier = await playerDB.getTier(player.id);

    const playerTierRole = await interaction.guild.roles.fetch(
      playerTier.discord_id
    );
    const targetTierRole = await interaction.guild.roles.fetch(
      targetTier.discord_id
    );
    const canSearch = canSearchTier(playerTier, targetTier);
    if (!canSearch)
      return await interaction.reply({
        content: `¡No puedes jugar en ${targetTierRole} siendo ${playerTierRole}!`,
        ephemeral: true,
      });

    let lobby = await lobbyDB.getByPlayer(player.id);
    const isSearching = lobby?.status === "SEARCHING";
    const hasTier = await lobbyDB.hasTier(lobby?.id, targetTier.id);

    if (!lobby) {
      await lobbyDB.create(guild.id, player.id, targetTier.id);
      lobby = await lobbyDB.getByPlayer(player.id);
    } else if (isSearching && !hasTier) {
      await lobbyDB.addTier(lobby.id, targetTier.id);
    } else
      return await interaction.reply({
        content: `O ya has encontrado partida, o ya estabas buscando en ${targetTierRole}.`,
        ephemeral: true,
      });

    const matchFound = await matchmaking(
      interaction,
      player.id,
      lobby.id,
      targetTier.id
    );

    if (!matchFound) {
      return await interaction.reply({
        content: `Listo, a partir de ahora estás buscando partida en ${targetTierRole} `,
        ephemeral: true,
      });
    }
  },
};
