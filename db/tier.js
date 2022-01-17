const db = require("./index");

const get = async (tierId, discord = false) =>
  await db.basicGet("tier", tierId, discord);

const getByMessage = async (messageDiscordId) => {
  const getQuery = {
    text: `
    SELECT * FROM tier
    WHERE search_message_id = $1
    `,
    values: [messageDiscordId],
  };

  const getResult = await db.query(getQuery);
  return getResult.rows ? getResult.rows[0] : null;
};

module.exports = {
  get,
  getByMessage,
};
