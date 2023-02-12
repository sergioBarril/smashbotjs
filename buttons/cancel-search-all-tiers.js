const cancelSearch = require("./cancel-search");

const execute = async (interaction) => {
  await cancelSearch.execute(interaction);
};

module.exports = {
  data: { name: "cancel-search-all-tiers" },
  execute,
};
