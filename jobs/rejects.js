const cron = require("node-cron");
const winston = require("winston");
const { removeOldRejects, countOldRejects } = require("../models/playerReject");

/**
 * Job that checks every 20th minute and cleans old rejects
 */
function clearRejectsJob() {
  cron.schedule("*/20 * * * *", async () => {
    try {
      const timeMargin = 45;

      const count = await countOldRejects(timeMargin);
      if (count > 0) {
        await removeOldRejects(timeMargin);
        winston.info(`Removed ${count} PlayerRejects.`);
      }
    } catch (e) {
      winston.error(e);
    }
  });
}
module.exports = { clearRejectsJob };
