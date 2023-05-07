const cron = require("node-cron");
const winston = require("winston");
const { removeOldRejects, countOldRejects } = require("../models/playerReject");

/**
 * Job that checks every 20th minute and cleans old rejects
 */
function clearRejectsJob() {
  cron.schedule("*/20 * * * *", async () => {
    try {
      const count = await countOldRejects();
      if (count > 0) {
        await removeOldRejects();
        winston.info(`Removed ${count} PlayerRejects.`);
      }
    } catch (e) {
      winston.error(e);
    }
  });
}
module.exports = { clearRejectsJob };
