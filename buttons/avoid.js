const { avoidPlayer } = require("../api/lobby");

const execute = async (interaction) => {
  await interaction.deferUpdate();
  const customId = interaction.customId.split("-");

  const time = Number(customId[1]);
  const playerId = customId[2];
  const playerId2 = customId[3];

  const rejecterPlayerId = interaction.user.id;
  const rejectedPlayerId = [playerId, playerId2].find((pid) => pid != rejecterPlayerId);

  await avoidPlayer(rejecterPlayerId, rejectedPlayerId, time);

  const rejectedPlayer = await interaction.guild.members.fetch(rejectedPlayerId);

  let messageText = `No te enfrentarás otra vez con **${rejectedPlayer.displayName}** hasta `;

  if (time > 1000) messageText += "mañana.";
  else if (time === 60) {
    messageText += "dentro de **1 hora**.";
  } else if (time > 60) {
    messageText += `dentro de **${time / 60} horas**.`;
  } else if (time == 0) {
    messageText = `Podrás enfrentarte otra vez con **${rejectedPlayer.displayName}** (si él no ha dicho lo contrario).`;
  }

  await interaction.followUp({ content: messageText, ephemeral: true });
};

module.exports = {
  data: { name: "avoid" },
  execute,
};
