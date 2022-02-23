const { assignRole } = require("../utils/discordRoles");

const execute = async (interaction) => {
  await assignRole(interaction, "PARSEC", "YUZU");
};

module.exports = {
  data: { name: "parsec-role" },
  execute,
};
