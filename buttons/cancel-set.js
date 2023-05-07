const { MessageActionRow, MessageButton } = require("discord.js");
const setAPI = require("../api/gameSet");
const lobbyAPI = require("../api/lobby");
const { setEndButtons } = require("../utils/discordGameset");

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

const firstVote = async (interaction, status, opponent) => {
  const player = interaction.member;
  const opponentMember = await interaction.guild.members.fetch(opponent.discordId);

  if (status)
    await interaction.reply(
      `${player.displayName} quiere cancelar el set, y hacer como si nada hubiera pasado. ${opponentMember}, dale tú también al botón si estás de acuerdo en cancelarlo.`
    );
  else
    await interaction.reply(`**${player.displayName}** ya no quiere cancelar el set. ¡A seguir!`);
};

module.exports = {
  data: { name: "cancel-set" },
  async execute(interaction) {
    const channel = interaction.channel;

    const { decided, status, opponent } = await lobbyAPI.voteCancelSet(
      interaction.user.id,
      channel.id
    );

    await interaction.message.edit({
      components: cancelSetButtons(interaction.message, decided, status),
    });

    if (!decided) return await firstVote(interaction, status, opponent);

    const isRanked = await setAPI.cancelSet(channel.id);

    await interaction.reply({
      content:
        `El set ha sido **cancelado**. ¿Qué set? Yo no he visto ningún set... ` +
        `Si queréis hacer otro dadle al botón. Si no, cerrad la arena cuando queráis.`,
      components: setEndButtons(isRanked, false),
    });
  },
};
