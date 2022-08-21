const { assignRole } = require("../utils/discordRoles");

const execute = async (interaction) => {
  await assignRole(interaction, "WIFI", "WIFI");
};

module.exports = {
  data: { name: "wifi-role" },
  execute,
};
