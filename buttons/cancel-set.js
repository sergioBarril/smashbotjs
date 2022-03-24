const { MessageActionRow, MessageButton } = require("discord.js");
const setAPI = require("../api/gameSet");
const lobbyAPI = require("../api/lobby");
const { setEndButtons } = require("../utils/discordGameset");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    NO_LOBBY: "No estás en ninguna arena... ¡no puedes jugar un set aquí!",
    NO_GAMESET: "¡No estás jugando ningún set! No hay nada a cancelar...",
  };
  const { name } = exception;

  // Get message
  let response = EXCEPTION_MESSAGES[name];
  if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

const cancelSetButtons = (message, decided, status) => {
  const newButtons = message.components.map((row) => {
    const newRow = new MessageActionRow();
    row.components.forEach((button) => {
      if (button.customId === "cancel-set") {
        if (decided) {
          button.setDisabled(true);
        } else if (status) button.setStyle("DANGER");
        else button.setStyle("SECONDARY");
      }
      newRow.addComponents(button);
    });
    return newRow;
  });

  return newButtons;
};

const firstVote = async (interaction, status) => {
  const player = interaction.member;
  const { discord_id: opponentId } = await lobbyAPI.getOpponent(player.id, interaction.channel.id);
  const opponent = await interaction.guild.members.fetch(opponentId);

  if (status)
    await interaction.reply(
      `${player.displayName} quiere cancelar el set, y hacer como si nada hubiera pasado. ${opponent}, dale tú también al botón si estás de acuerdo en cancelarlo.`
    );
  else
    await interaction.reply(`**${player.displayName}** ya no quiere cancelar el set. ¡A seguir!`);
};

module.exports = {
  data: { name: "cancel-set" },
  async execute(interaction) {
    const channel = interaction.channel;

    try {
      const { decided, status } = await lobbyAPI.voteCancelSet(interaction.user.id, channel.id);

      await interaction.message.edit({
        components: cancelSetButtons(interaction.message, decided, status),
      });

      if (!decided) return await firstVote(interaction, status);

      await setAPI.cancelSet(channel.id);

      https: await interaction.reply({
        content:
          `El set ha sido **cancelado**. ¿Qué set? Yo no he visto ningún set... ` +
          `Si queréis hacer otro dadle al botón. Si no, cerrad la arena cuando queráis.`,
        components: setEndButtons(),
      });
    } catch (e) {
      await exceptionHandler(interaction, e);
    }
  },
};
