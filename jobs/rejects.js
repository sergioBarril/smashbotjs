const cron = require("node-cron");
const { removeOldRejects, countOldRejects } = require("../models/playerReject");

function clearRejectsJob() {
  cron.schedule("*/20 * * * *", async () => {
    try {
      const timeMargin = 45;

      const count = await countOldRejects(timeMargin);
      if (count > 0) {
        await removeOldRejects(timeMargin);
        console.log(`Removed ${count} PlayerRejects.`);
      }
    } catch (e) {
      console.error(e);
    }
  });
}
module.exports = { clearRejectsJob };
