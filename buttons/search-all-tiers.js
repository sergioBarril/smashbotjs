const search = require("./search");

const execute = async (interaction) => {
  await search.execute(interaction);
};

module.exports = {
  data: { name: "search-all-tiers" },
  execute,
};
