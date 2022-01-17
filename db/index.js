const { Pool } = require("pg");
const credentials = require("./config.json");

const pool = new Pool(credentials);

module.exports = {
  async query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log("executed query", { text, duration, rows: res.rowCount });
    return res;
  },
  async getClient() {
    const client = await pool.connect();
    return client;
  },

  async basicGet(table, pk, discord = false, client = null) {
    if (!pk) return null;

    const getQuery = {
      text: `
      SELECT * FROM ${table} 
      WHERE ${discord ? "discord_id" : "id"} = $1`,
      values: [pk],
    };

    const getRes = await (client ?? pool).query(getQuery);
    return getRes.rows.length === 1 ? getRes.rows[0] : null;
  },

  async basicRemove(table, pk, discord = false, client = null) {
    if (!pk) return false;

    const removeQuery = {
      text: `
      DELETE FROM ${table} 
      WHERE ${discord ? "discord_id" : "id"} = $1`,
      values: [pk],
    };

    await (client ?? pool).query(removeQuery);
    return true;
  },
};
