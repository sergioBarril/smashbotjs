const { assignRole } = require("../utils/discordRoles");

const execute = async (interaction) => {
  await assignRole(interaction, "YUZU", "YUZU");
};

module.exports = {
  data: { name: "yuzu-role" },
  execute,
};
