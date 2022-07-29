const { Pool } = require("pg");
const credentials = require("./config.json");

const pool = new Pool(credentials);

module.exports = {
  async query({ text, values }, client = null) {
    const res = await (client ?? pool).query(text, values);
    return res;
  },
  async getClient() {
    const client = await pool.connect();
    return client;
  },

  async getQuery(queryString, client = null, many = false) {
    const getRes = await this.query(queryString, client);
    if (many) return getRes.rows;
    else return getRes.rows.length > 0 ? getRes.rows[0] : null;
  },

  async insertQuery(queryString, client = null) {
    const insertRes = await this.query(queryString, client);
    return insertRes;
  },

  async deleteQuery(queryString, client = null) {
    return await this.insertQuery(queryString, client);
  },

  async updateQuery(queryString, client = null) {
    return await this.insertQuery(queryString, client);
  },

  async basicGet(table, pk, discord = false, client = null) {
    if (!pk) return null;

    const getQueryString = {
      text: `
      SELECT * FROM ${table} 
      WHERE ${discord ? "discord_id" : "id"} = $1`,
      values: [pk],
    };

    return await this.getQuery(getQueryString, client);
  },

  async getBy(table, dict, client = null) {
    const results = await this.filterBy(table, dict, client);
    if (results && results.length > 0) return results[0];
    else return null;
  },

  async filterBy(table, dict, client = null) {
    const values = Object.values(dict);

    const queryString = {
      text: `
      SELECT * FROM ${table}
      WHERE ${Object.keys(dict)
        .map((field, index) => `${field} ${values[index] == null ? "IS" : "="} $${index + 1}`)
        .join(" AND ")}`,
      values: Object.values(dict),
    };

    const getRes = await this.getQuery(queryString, client, true);
    return getRes;
  },

  async updateBy(table, dictSet, dictWhere, client = null) {
    const setValuesString = Object.keys(dictSet)
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ");

    const numValues = Object.keys(dictSet).length;
    const whereConditions = Object.keys(dictWhere)
      .map((field, index) => `${field} = $${index + numValues + 1}`)
      .join(" AND ");

    const updateQuery = {
      text: `
      UPDATE ${table}
      SET ${setValuesString}
      WHERE ${whereConditions}`,
      values: Object.values(dictSet).concat(Object.values(dictWhere)),
    };

    await this.query(updateQuery, client);
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

  async countRows(table, client = null) {
    const query = {
      text: `SELECT COUNT(1) AS COUNT FROM ${table}`,
    };

    return parseInt((await this.getQuery(query, client)).count);
  },

  async close() {
    await pool.end();
  },
};
