const { assignRole } = require("../utils/discordRoles");
const lobbyAPI = require("../api/lobby");
const { CustomError } = require("../errors/customError");
const { getGuild } = require("../api/guild");
const winston = require("winston");

const execute = async (interaction) => {
  await interaction.deferUpdate();
  const player = interaction.member;
  const isInAnyLobby = await lobbyAPI.isInAnyLobby(player.id);

  if (isInAnyLobby) {
    throw new CustomError(
      "Ya estás buscando, jugando, o en proceso de confirmación. Vuelve a darle cuando no estés haciendo nada."
    );
  }
  const { noDmRoleId } = await getGuild(interaction.guild.id);

  const noDmRole = await interaction.guild.roles.fetch(noDmRoleId);
  await player.roles.remove(noDmRole);

  winston.info(`${player.displayName} ya no tiene el rol 'NO DM'`);

  await interaction;
};

module.exports = {
  data: { name: "no-dm-role" },
  execute,
};
