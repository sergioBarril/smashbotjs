const { updateLeaderboard } = require("../../../utils/discordLeaderboard");

const update = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  await updateLeaderboard(guild);
  await interaction.editReply({
    content: "¡Canal #leaderboards actualizado!",
    ephemeral: true,
  });
};

module.exports = { update };
