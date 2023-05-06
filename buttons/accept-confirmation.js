const lobbyAPI = require("../api/lobby");
const setAPI = require("../api/gameSet");
const ratingAPI = require("../api/rating");

const { MessageActionRow, MessageButton, Permissions } = require("discord.js");
const { Player } = require("../models/player");
const { Guild } = require("../models/guild");
const { NotFoundError } = require("../errors/notFound");
const { Message, MESSAGE_TYPES } = require("../models/message");
const {
  setupNextGame,
  setupCharacter,
  setEndButtons,
  bonusSetText,
} = require("../utils/discordGameset");
const winston = require("winston");

// Disabled buttons

const disabledConfirmationButtonBuilder = (playerDiscordId) => {
  return new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId(`accept-confirmation-${playerDiscordId}`)
      .setLabel("Aceptar")
      .setStyle("SUCCESS")
      .setDisabled(),
    new MessageButton()
      .setCustomId(`decline-confirmation-${playerDiscordId}`)
      .setLabel("Rechazar")
      .setStyle("DANGER")
      .setDisabled()
  );
};

const timeoutButtonBuilder = (playerDiscordId) => {
  return new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId(`rival-is-afk-${playerDiscordId}`)
      .setLabel("Buscar nuevo oponente")
      .setStyle("DANGER")
  );
};

const cancelSetButtons = () => {
  return [
    new MessageActionRow().addComponents(
      new MessageButton().setCustomId("cancel-set").setStyle("SECONDARY").setLabel("Anular set"),
      new MessageButton().setCustomId("afk-set").setStyle("SECONDARY").setLabel("Mi rival está AFK")
    ),
  ];
};

/**
 * Creates the private text and voice channels
 * @param {*} interaction Discord interaction object.
 * @param {Array<>} players Array of Discord User objects
 * @param {Guild} guild Guild where the lobby is (not the Discord object)
 * @param {boolean} ranked True if the arena is ranked
 * @returns Object with two properties:
 *   - text (Channel) : Text channel discord object
 *   - voice (Channel) : Voice channel discord object
 */
const createArena = async (interaction, players, guild, ranked) => {
  const discordGuild = await interaction.client.guilds.fetch(guild.discordId);
  if (!discordGuild) throw new NotFoundError("Guild");
  const arenaCategory = discordGuild.channels.cache.find(
    (chan) => chan.type === "GUILD_CATEGORY" && chan.name === "ARENAS"
  );

  // Needs arena name
  const textPermission = players.map((player) => {
    return {
      id: player.id,
      allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES],
    };
  });

  const voicePermisssion = players.map((player) => {
    return {
      id: player.id,
      allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.CONNECT],
    };
  });

  const arenaName = ranked ? "ranked-arena" : "arena";
  const channel = await discordGuild.channels.create(arenaName, {
    type: "GUILD_TEXT",
    parent: arenaCategory.id,
    permissionOverwrites: [
      {
        id: discordGuild.id,
        deny: [Permissions.FLAGS.VIEW_CHANNEL],
      },
      ...textPermission,
    ],
  });

  const voiceChannel = await discordGuild.channels.create(arenaName, {
    type: "GUILD_VOICE",
    parent: arenaCategory.id,
    permissionOverwrites: [
      {
        id: discordGuild.id,
        deny: [Permissions.FLAGS.VIEW_CHANNEL],
      },
      ...voicePermisssion,
    ],
  });

  if (!ranked) {
    const newSet = setEndButtons(ranked, true);
    const firstMessageText = `¡Bienvenidos! Jugad todo lo que queráis y cerrad la arena cuando acabéis.`;
    await channel.send({
      content: firstMessageText,
      components: newSet,
    });
  }

  winston.info(`Text channel y voice channel creados para ${players.map((p) => p.username)}`);
  winston.debug(`Text: ${channel.id}. Voice: ${voiceChannel.id}`);
  return { text: channel, voice: voiceChannel };
};

/**
 * Edits Direct messages
 * @param {Object} channels Object with two properties: text has the TextChannel and
 * voice has the VoiceChannel
 * @param {Array<Message>} messages
 */
const editDMs = async (channels, messages) => {
  const { text: textChannel, voice: voiceChannel } = channels;

  let updatedText =
    `¡Hay partido! Dirígete a ${textChannel} y a pelear.\n` +
    `También podéis ir a ${voiceChannel} para disfrutar de un voice chat privado.`;

  const guildText = ` En principio esto era un DM, pero los tienes cerrados. Ábrelos, o sigue usando este canal -- lo que prefieras.`;

  for (let message of messages) {
    let messageGuildText = guildText;
    if (message.channel.type === "DM") messageGuildText = "";
    await message.edit({
      content: updatedText + messageGuildText,
      components: [],
    });
  }
};

/**
 * Updates the #tier-X messages
 * @param {Interaction} interaction DiscordJS interaction object
 * @param {string} guildDiscordId Discord ID of the Guild
 * @param {Array<Message>} tierMessages List of messages to edit
 * @param {Array<Player>} players List of players
 */
const editTierMessages = async (interaction, guildDiscordId, tierMessages, players) => {
  if (tierMessages.length === 0) return;

  const guild = await interaction.client.guilds.fetch(guildDiscordId);

  const members = await Promise.all(
    players.map(async (player) => await guild.members.fetch(player.discordId))
  );

  const memberFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const memberNames = memberFormatter.format(members.map((member) => `**${member.displayName}**`));

  updatedText = `${memberNames} están jugando.`;

  for (messageInfo of tierMessages) {
    const channel = await guild.channels.fetch(messageInfo.channelId);
    const message = await channel.messages.fetch(messageInfo.discordId);

    await message.edit({
      content: updatedText,
      components: [],
    });
  }
};

/**
 * Promise that sleeps some time, and then if the opponent hasn't accepted yet,
 * gives the option to cancel
 * @param {Message} message Discord message object
 * @param {string} acceptedPlayerId DiscordId of the player that already accepted before
 * @param {Date} acceptedAt Timestamp when accepted
 */
const timeOutMessage = async (message, acceptedPlayerId, acceptedAt) => {
  await new Promise((r) => setTimeout(r, 90000));

  const isAfk = await lobbyAPI.timeOutCheck(acceptedPlayerId, acceptedAt);

  if (isAfk)
    await message.edit({
      content: `Parece que tu rival no contesta... Cuando te canses de esperar, pulsa el botón para buscar un nuevo oponente.`,
      components: [timeoutButtonBuilder(acceptedPlayerId)],
    });
};

/**
 * Edits all messages (DMs and #tier) and setups the arena
 *
 * @param {Interaction} interaction Discord interaction object
 * @param {Array<Player>} players Array of players in the lobby
 * @param {Guild} guild Guild model where the lobby is
 */
const allAccepted = async (interaction, players, guild, ranked) => {
  const discordPlayers = await Promise.all(
    players.map(async (player) => await interaction.client.users.fetch(player.discordId))
  );

  const channels = await createArena(interaction, discordPlayers, guild, ranked);
  let { tierMessages, directMessages } = await lobbyAPI.setupArena(
    interaction.user.id,
    channels.text.id,
    channels.voice.id
  );

  const discordGuild = await interaction.client.guilds.fetch(guild.discordId);

  if (ranked) {
    const { players: setPlayers } = await setAPI.newSet(channels.text.id, 3);

    const members = await Promise.all(
      setPlayers.map(async (p) => await discordGuild.members.fetch(p.discordId))
    );

    const memberFormatter = new Intl.ListFormat("es");
    const memberNames = memberFormatter.format(
      members.map((member) => `**${member.displayName}**`)
    );

    const dps = members.map((m) => m.id);
    const [dp1, dp2] = dps;

    const bonusText = await bonusSetText(dp1, dp2, guild.discordId, members);

    await channels.text.send({
      content: `¡Marchando un set ranked BO5 entre ${memberNames}!${bonusText}\nSi hay algún problema y ambos estáis de acuerdo en cancelar el set, pulsad el botón.`,
      components: cancelSetButtons(),
    });

    await channels.text.send("__**Game 1**__");
    winston.info(`Inicio del Game 1 entre ${memberNames}`);

    await Promise.all([
      members.map((member) => setupCharacter(channels.text, member, 1, discordGuild)),
    ]);
  }

  // Fetch Discord DMs
  const dms = await Promise.all(
    directMessages.map(async (message) => {
      let channel = null;
      if (message.type === MESSAGE_TYPES.LOBBY_PLAYER) {
        const player = players.find((p) => p.id === message.playerId);
        const discordPlayer = discordPlayers.find((dp) => dp.id === player.discordId);
        channel = await discordPlayer.createDM();
      } else channel = await discordGuild.channels.fetch(message.channelId);

      return await channel.messages.fetch(message.discordId);
    })
  );

  await editDMs(channels, dms);
  await editTierMessages(interaction, guild.discordId, tierMessages, players);
};

/**
 * If there's someone who hasn't accepted yet, disable buttons
 * for those that have.
 * Also edits the message, and launches timeout button promise
 * @param {Interaction} interaction
 * @param {Array<Player>} notAcceptedPlayers
 * @param {Date} acceptedAt
 */
const notAllAccepted = async (interaction, notAcceptedPlayers, acceptedAt, isRanked) => {
  const notAcceptedPlayersNames = [];
  for (let playerInfo of notAcceptedPlayers) {
    const player = await interaction.client.users.fetch(playerInfo.discordId);
    notAcceptedPlayersNames.push(`**${player.username}**`);
  }
  let missingNames = notAcceptedPlayersNames.join(", ");
  if (isRanked) missingNames = "tu **rival**";

  await interaction.editReply({
    content: `Has aceptado, pero todavía falta que acepte ${missingNames}.`,
    components: [disabledConfirmationButtonBuilder(interaction.user.id)],
  });

  timeOutMessage(interaction.message, interaction.user.id, acceptedAt);
};

const execute = async (interaction) => {
  const customId = interaction.customId.split("-");
  const buttonPlayerId = customId.at(-1);

  const playerDiscordId = interaction.user.id;

  if (buttonPlayerId != playerDiscordId) {
    return await interaction.reply({
      content: `¡Estos son los botones de otro jugador! ¡Cotilla!`,
      ephemeral: true,
    });
  }

  winston.info(`${interaction.user.username} acaba de empezar a aceptar el match`);

  await interaction.deferUpdate();
  const { hasEveryoneAccepted, players, acceptedAt, guild, ranked } = await lobbyAPI.acceptMatch(
    playerDiscordId
  );

  winston.info(`${interaction.user.username} ha aceptado el match correctamente`);

  if (hasEveryoneAccepted) {
    await allAccepted(interaction, players, guild, ranked);
  } else {
    await notAllAccepted(interaction, players, acceptedAt, ranked);
  }
};

module.exports = {
  data: { name: "accept-confirmation" },
  execute,
};
