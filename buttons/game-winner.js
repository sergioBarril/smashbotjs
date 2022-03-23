const setAPI = require("../api/gameSet");
const smashCharacters = require("../params/smashCharacters.json");

const { MessageActionRow } = require("discord.js");
const { setupNextGame } = require("../utils/discordGameset");

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

  await interaction.deferUpdate();
  if (winner) {
    const winnerPlayer = await interaction.guild.members.fetch(winner.discord_id);
    const characterName = winner.character_name;
    const { emoji } = smashCharacters[characterName];

    const score = await setAPI.getScore(interaction.channel.id);

    // Get players and emojis for the response
    const pc = await setAPI.getPlayersAndCharacters(votedPlayerId);
    let playersScore = [];
    for ({ discord_id: playerId, character_name: charName } of pc) {
      const player = await interaction.guild.members.fetch(playerId);
      const emoji = smashCharacters[charName].emoji;
      const playerScore = score.find((p) => p.discord_id === player.id).wins;
      playersScore.push({ playerText: `**${player.displayName}** ${emoji}`, playerScore });
    }

    let scoreText = `El marcador va ${playersScore[0].playerText} ${playersScore[0].playerScore}`;
    scoreText += ` - ${playersScore[1].playerScore} ${playersScore[1].playerText}`;

    await message.edit({
      content: `¡**${winnerPlayer.displayName}** ${emoji} ha ganado el **Game ${gameNum}**! ${scoreText}`,
      components: buttons,
    });

    await setupNextGame(interaction, gameNum);
  } else await message.edit({ components: buttons });
};

module.exports = {
  data: { name: "game-winner" },
  execute,
};
