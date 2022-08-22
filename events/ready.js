const { searchListJob } = require("../jobs/list");

module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    searchListJob(client);

    // console.log("preout");
    // const discordGuild = await client.guilds.fetch("885501308805738577");
    // console.log("discGuildPostout");
    // console.log(discordGuild);
  },
};
