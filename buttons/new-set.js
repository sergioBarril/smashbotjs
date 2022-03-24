const { MessageActionRow } = require("discord.js");
const setAPI = require("../api/gameSet");
const lobbyAPI = require("../api/lobby");
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

const firstVote = async (interaction, status) => {
  const player = interaction.member;
  const { discord_id: opponentId } = await lobbyAPI.getOpponent(player.id, interaction.channel.id);
  const opponent = await interaction.guild.members.fetch(opponentId);

  if (status)
    await interaction.reply(
      `${player.displayName} quiere jugar un set BO5. ${opponent}, ¡dale tú también al botón si quieres jugar!`
    );
  else await interaction.reply(`**${player.displayName}** ya no quiere jugar un set BO5.`);
};

module.exports = {
  data: { name: "new-set" },
  async execute(interaction) {
    const channel = interaction.channel;

    try {
      const { decided, status } = await lobbyAPI.voteNewSet(interaction.user.id, channel.id);

      await interaction.message.edit({
        components: newSetButtons(interaction.message, decided, status),
      });

      if (!decided) return await firstVote(interaction, status);

      const { players } = await setAPI.newSet(channel.id);

      const members = [];

      for (player of players) {
        const member = await interaction.guild.members.fetch(player.discord_id);
        members.push(member);
      }

      const memberFormatter = new Intl.ListFormat("es");
      const memberNames = memberFormatter.format(
        members.map((member) => `**${member.displayName}**`)
      );

      await interaction.reply({
        content: `¡Marchando un set BO5 entre ${memberNames}!`,
        components: [],
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
