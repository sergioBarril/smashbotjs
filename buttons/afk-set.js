const { MessageActionRow, MessageButton } = require("discord.js");
const { isRankedSet, getGameNumber, cancelSet, surrender } = require("../api/gameSet");
const { getPlayingPlayers } = require("../api/lobby");
const { setEndButtons, setupNextGame } = require("../utils/discordGameset");
const winston = require("winston");

const afkSetButtons = (afkTimeLimit, formattedTimeLimit, playerDiscordId, cancelSetButton) => {
  return [
    new MessageActionRow().addComponents(
      cancelSetButton,
      new MessageButton()
        .setCustomId(`afk-set-${afkTimeLimit.getTime()}-${playerDiscordId}`)
        .setStyle("DANGER")
        .setLabel(`Mi rival está AFK (${formattedTimeLimit})`),
      new MessageButton().setCustomId("afk-set-back").setStyle("SUCCESS").setLabel("¡Ha vuelto!")
    ),
  ];
};

const resetRow = (cancelSetButton) => {
  return [
    new MessageActionRow().addComponents(
      cancelSetButton,
      new MessageButton().setCustomId("afk-set").setStyle("SECONDARY").setLabel("Mi rival está AFK")
    ),
  ];
};

const getCancelButton = (components) => {
  if (components.length == 0) return null;
  return components[0].components.find((b) => b.customId === "cancel-set");
};

const getAfkBackButton = (components) => {
  if (components.length == 0) return null;
  return components[0].components.find((b) => b.customId === "afk-set-back");
};

const getAfkButton = (components) => {
  if (components.length == 0) return null;
  return components[0].components.find(
    (b) => b.customId !== "afk-set-back" && b.customId.startsWith("afk-set")
  );
};

const afkSetCancelledButtons = (afkButton, afkBackButton) => {
  return [
    new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("cancel-set")
        .setStyle("SECONDARY")
        .setLabel("Anular set")
        .setDisabled(true),
      afkButton.setDisabled(true).setStyle("DANGER"),
      afkBackButton.setDisabled(true).setLabel("No volvió...").setStyle("SECONDARY")
    ),
  ];
};

async function startAfkTimer(interaction, opponent) {
  // Get AFK time
  const AFK_TIME_LIMIT = 15;
  const now = new Date();
  const afkTimeLimit = new Date(now.getTime() + 1000 * AFK_TIME_LIMIT);
  const hoursText = String(afkTimeLimit.getHours()).padStart(2, "0");
  const minutesText = String(afkTimeLimit.getMinutes()).padStart(2, "0");
  const formattedTimeLimit = `${hoursText}:${minutesText}`;

  const messageText =
    `Vaya, ${interaction.member}. Parece que ${opponent} está AFK. Dale de nuevo al botón dentro de 10 minutos (a las **${formattedTimeLimit}**) para cerrar el set.\n` +
    `Si por el contrario vuelve antes de eso, dadle al botón de **"¡Ha vuelto!"** para seguir con el set.`;

  const dmText = `¿${opponent}? ¿Estás ahí? ¡Tienes a **${interaction.member.displayName}** esperándote para jugar! ¡Corre, tienes 10 minutos para volver!`;

  await interaction.followUp(messageText);
  await opponent.send(dmText);

  const cancelButton = getCancelButton(interaction.message.components);

  await interaction.message.edit({
    content: interaction.message.content,
    components: afkSetButtons(afkTimeLimit, formattedTimeLimit, interaction.user.id, cancelButton),
  });
}

async function playerIsBack(interaction) {
  const messageText = `¡Ya ha vuelto! Seguid con el set, pues.`;
  await interaction.followUp(messageText);

  const cancelButton = getCancelButton(interaction.message.components);

  await interaction.message.edit({
    content: interaction.message.content,
    components: resetRow(cancelButton),
  });
}

async function cancelSetAfk(interaction, opponent, customId, isRanked) {
  const playerDiscordId = customId.at(-1);

  // Only the player that started it can complete it
  if (playerDiscordId != interaction.user.id) {
    return await interaction.followUp({
      content: `¡Tú no le puedes dar! Tiene que darle tu rival. Pero si estás aquí... ¡corre, **dale al otro botón** para marcar como que ya has vuelto!`,
      ephemeral: true,
    });
  }

  // Time
  const afkTimeLimit = new Date(Number(customId.at(-2)));
  const now = new Date();

  if (now < afkTimeLimit) {
    let diffMs = afkTimeLimit - now;
    let minutesText = "";
    if (diffMs >= 120000) {
      minutesText = String(Math.floor(diffMs / 60000)) + " minutos";
    } else if (diffMs >= 60000) minutesText = "1 minuto";

    diffMs %= 60000;
    let secondsText = "";
    if (diffMs >= 2000) secondsText = String(Math.floor(diffMs / 1000)) + " segundos";
    else if (diffMs >= 1000) secondsText = "1 segundo";

    const y = minutesText && secondsText ? " y " : "";

    return await interaction.followUp({
      content: `¡Aún es demasiado pronto! Vuelve a darle dentro de **${minutesText}${y}${secondsText}**.`,
      ephemeral: true,
    });
  }

  const gameNum = await getGameNumber(interaction.channel.id);

  // If no game has finished, the set is cancelled
  if (gameNum == 1) {
    await cancelSet(interaction.channel.id);
    winston.info(`El set ha sido cancelado ya que ${opponent.displayName} está AFK.`);
    await interaction.followUp({
      content:
        `El set ha sido **cancelado**. ¿Qué set? Yo no he visto ningún set... ` +
        `Si queréis hacer otro dadle al botón. Si no, cerrad la arena cuando queráis.`,
      components: setEndButtons(isRanked, false),
    });
  } else {
    // If a game has been already played, the AFK player surrenders
    await surrender(opponent.id, interaction.channel.id);
    winston.info(`${opponent.displayName} se ha rendido por estar AFK.`);
    await setupNextGame(interaction);
  }

  const afkButton = getAfkButton(interaction.message.components);
  const afkBackButton = getAfkBackButton(interaction.message.components);

  return await interaction.message.edit({
    content: interaction.message.content,
    components: afkSetCancelledButtons(afkButton, afkBackButton),
  });
}

const execute = async (interaction) => {
  await interaction.deferUpdate();
  const customId = interaction.customId.split("-");
  let isRanked = false;

  //   Check if ongoing set
  let players;
  try {
    isRanked = await isRankedSet(interaction.user.id);
    players = await getPlayingPlayers(interaction.channel.id);
  } catch (e) {
    return await interaction.followUp({
      content: "Ya no hay ningú set en curso.",
      ephemeral: true,
    });
  }

  const otherPlayerInfo = players.find((p) => p.discordId != interaction.user.id);
  const opponent = await interaction.guild.members.fetch(otherPlayerInfo.discordId);

  if (customId.length === 2) await startAfkTimer(interaction, opponent);
  else if (customId.length === 3) await playerIsBack(interaction);
  else await cancelSetAfk(interaction, opponent, customId, isRanked);
};

module.exports = {
  data: { name: "afk-set" },
  execute,
};
