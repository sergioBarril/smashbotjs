const winston = require("winston");
const { dailyCleanup } = require("../jobs/cleanup");
const { searchListJob } = require("../jobs/list");
const { clearRejectsJob } = require("../jobs/rejects");

module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    winston.info("--- Ready ---");

    searchListJob(client);
    dailyCleanup(client);
    clearRejectsJob();
  },
};
