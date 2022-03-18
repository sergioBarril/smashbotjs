const friendlies = require("./cancel-friendlies");

const execute = async (interaction) => {
  await friendlies.execute(interaction);
};

module.exports = {
  data: { name: "cancel-friendlies-all-tiers" },
  execute,
};
