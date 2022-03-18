const friendlies = require("./friendlies");

const execute = async (interaction) => {
  await friendlies.execute(interaction);
};

module.exports = {
  data: { name: "friendlies-all-tiers" },
  execute,
};
