const { MessageActionRow, MessageButton, Interaction } = require("discord.js");
const setAPI = require("../api/gameSet");
const lobbyAPI = require("../api/lobby");
const { Player } = require("../models/player");
const { setupCharacter } = require("../utils/discordGameset");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    NO_LOBBY: "No estás en ninguna arena... ¡no puedes jugar un set aquí!",
    EXISTING_GAMESET: "¡Ya estás jugando un set aquí! Acabadlo, o canceladlo primero.",
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

const newSetButtons = (message, decided, status) => {
  const newButtons = message.components.map((row) => {
    const newRow = new MessageActionRow();
    row.components.forEach((button) => {
      if (button.customId === "close-lobby" && decided) button.setDisabled(true);
      if (button.customId === "new-set") {
        if (decided) {
          button.setStyle("SUCCESS");
          button.setDisabled(true);
        } else if (status) button.setStyle("PRIMARY");
        else button.setStyle("SECONDARY");
      }
      newRow.addComponents(button);
    });
    return newRow;
  });

  return newButtons;
};

/**
 * Reply in case only one player has requested a new set
 * @param {Interaction} interaction DiscordJS interaction
 * @param {boolean} status True if requested a new set, False if cancelling the request
 * @param {string} opponentDiscordId Discord ID of the opponent
 */
const firstVote = async (interaction, status, opponentDiscordId) => {
  const player = interaction.member;
  const opponent = await interaction.guild.members.fetch(opponentDiscordId);

  if (status)
    await interaction.reply(
      `${player.displayName} quiere jugar un set BO5. ${opponent}, ¡dale tú también al botón si quieres jugar!`
    );
  else await interaction.reply(`**${player.displayName}** ya no quiere jugar un set BO5.`);
};

const cancelSetButtons = () => {
  return [
    new MessageActionRow().addComponents(
      new MessageButton().setCustomId("cancel-set").setStyle("SECONDARY").setLabel("Anular set")
    ),
  ];
};

module.exports = {
  data: { name: "new-set" },
  async execute(interaction) {
    const channel = interaction.channel;

    try {
      const { decided, status, opponent } = await setAPI.voteNewSet(interaction.user.id);

      await interaction.message.edit({
        components: newSetButtons(interaction.message, decided, status),
      });

      if (!decided) return await firstVote(interaction, status, opponent.discordId);

      const { players } = await setAPI.newSet(opponent.discordId);

      const members = await Promise.all(
        players.map(async (p) => await interaction.guild.members.fetch(p.discordId))
      );

      const memberFormatter = new Intl.ListFormat("es");
      const memberNames = memberFormatter.format(
        members.map((member) => `**${member.displayName}**`)
      );

      await interaction.reply({
        content: `¡Marchando un set BO5 entre ${memberNames}! Si hay algún problema y ambos estáis de acuerdo en cancelar el set, pulsad el botón:`,
        components: cancelSetButtons(),
      });

      await interaction.channel.send("__**Game 1**__");

      await Promise.all([
        members.map((member) => setupCharacter(channel, member, interaction.guild.id, 1)),
      ]);
    } catch (e) {
      await exceptionHandler(interaction, e);
    }
  },
};
