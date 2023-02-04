const winston = require("winston");
const lobbyAPI = require("../../../api/lobby");

const deleteLobbies = async (interaction) => {
  const guild = interaction.guild;
  const type = interaction.options.getString("type");
  const member = interaction.options.getMember("player");

  const count = await lobbyAPI.deleteLobbies(guild.id, type, member?.id);

  winston.info(
    `[${interaction.user.username}] Se han eliminado ${count} lobbies en estado de ${type}`
  );
  await interaction.reply(`Se han eliminado ${count} lobbies en estado de ${type}`);
};

module.exports = { deleteLobbies };
