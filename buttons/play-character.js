const setAPI = require("../api/gameSet");

const { MessageActionRow, MessageButton } = require("discord.js");
const smashCharacters = require("../params/smashCharacters.json");
const { setupBans, setupGameWinner, setupCharacter } = require("../utils/discordGameset");

const allHavePicked = async (interaction, playerId, gameNum) => {
  await interaction.deferUpdate();

  // Delete all charpick messages
  const { charMessages } = await setAPI.popCharacterMessages(playerId);
  for ({ char_message: messageId } of charMessages) {
    const message = await interaction.channel.messages.fetch(messageId);
    await message.delete();
  }

  // Get players and emojis for the response
  const pc = await setAPI.getPlayersAndCharacters(playerId);
  const playerEmojis = [];
  for ({ discord_id: playerId, character_name: charName } of pc) {
    const player = await interaction.guild.members.fetch(playerId);
    const emoji = smashCharacters[charName].emoji;
    playerEmojis.push(`**${player.displayName}** ${emoji}`);
  }
  const playersText = new Intl.ListFormat("es").format(playerEmojis);
  await interaction.channel.send({
    content: `El **Game ${gameNum}** será entre ${playersText}.`,
  });

  if (gameNum == 1) return await setupBans(interaction, gameNum);
  else return await setupGameWinner(interaction, gameNum);
};

const disableAllButtons = (message) => {
  const disabledComponents = message.components.map((row) => {
    const newRow = new MessageActionRow();
    row.components.forEach((button) => {
      button.setDisabled(true);
      newRow.addComponents(button);
    });
    return newRow;
  });

  return disabledComponents;
};

const pickingIsNotOver = async (interaction, gameNum, charName, charMessage, opponent) => {
  const message = await interaction.channel.messages.fetch(charMessage);
  const disabledComponents = disableAllButtons(message);

  const emoji = smashCharacters[charName].emoji;
  const player = await interaction.guild.members.fetch(interaction.user.id);

  let editedMessage = `**${player.displayName}** ha escogido **${charName}** ${emoji}`;
  if (gameNum === 1) editedMessage = `**${player.displayName}** ya ha escogido personaje.`;

  await message.edit({
    content: editedMessage,
    components: disabledComponents,
  });

  await interaction.reply({
    content: `Has seleccionado **${charName}** ${emoji}. Espera a que tu rival acabe de pickear.`,
    ephemeral: true,
  });

  if (gameNum > 1)
    return await setupCharacter(interaction.channel, opponent, interaction.guild.id, gameNum);
};

const execute = async (interaction) => {
  const customId = interaction.customId.split("-");
  const playerId = customId[2];
  const gameNum = Number(customId[3]);

  if (interaction.user.id != playerId) {
    return await interaction.reply({
      content: `¡Estos son los botones del otro jugador! Tú ya tienes los tuyos...`,
      ephemeral: true,
    });
  }
  const charName = interaction.component.label;

  const { allPicked, charMessage, opponent } = await setAPI.pickCharacter(playerId, charName);

  if (allPicked) await allHavePicked(interaction, playerId, gameNum);
  else {
    const opponentPlayer = await interaction.guild.members.fetch(opponent.discord_id);
    await pickingIsNotOver(interaction, gameNum, charName, charMessage, opponentPlayer);
  }
};

module.exports = {
  data: { name: "play-character" },
  execute,
};