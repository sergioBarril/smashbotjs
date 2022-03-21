const setAPI = require("../api/gameSet");
const smashCharacters = require("../params/smashCharacters.json");

const { MessageActionRow } = require("discord.js");

const pickWinnerButtons = (message, votedPlayerId, isOpponentVoted, isDone) => {
  const winnerComponents = message.components.map((row) => {
    const newRow = new MessageActionRow();
    row.components.forEach((button) => {
      const isVoted = button.customId.includes(votedPlayerId);

      let style = "SECONDARY";
      if (isVoted && isDone) style = "SUCCESS";
      else if (isDone) style = "DANGER";
      else if (isVoted || isOpponentVoted) style = "PRIMARY";

      button.setStyle(style);
      button.setDisabled(isDone);
      newRow.addComponents(button);
    });
    return newRow;
  });

  return winnerComponents;
};

const execute = async (interaction) => {
  const message = interaction.message;
  const player = interaction.member;

  const customId = interaction.customId.split("-");
  const votedPlayerId = customId[2];
  const gameNum = customId[3];

  const isWinner = player.id == votedPlayerId;

  const { winner, opponent } = await setAPI.pickWinner(player.id, isWinner, gameNum);

  const buttons = pickWinnerButtons(message, votedPlayerId, opponent.winner, winner != null);

  if (winner) {
    const winnerPlayer = await interaction.guild.members.fetch(winner.discord_id);
    const characterName = winner.character_name;
    const { emoji } = smashCharacters[characterName];

    await message.edit({
      content: `¡**${winnerPlayer.displayName}** ${emoji} ha ganado el **Game ${gameNum}**!`,
      components: buttons,
    });
  } else await message.edit({ components: buttons });
  await interaction.deferUpdate();
};

module.exports = {
  data: { name: "game-winner" },
  execute,
};
