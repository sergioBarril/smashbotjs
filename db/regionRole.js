const db = require("./index");

const get = async (roleId, discord = false, client = null) =>
  await db.basicGet("region_role", roleId, discord, client);

const getByRegion = async (regionId, guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT * FROM region_role
    WHERE region_id = $1
    AND guild_id = $2
    `,
    values: [regionId, guildId],
  };

  const getResult = await (client ?? db).query(getQuery);

  return getResult.rows[0];
};

const getByName = async (regionName, guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT rr.* 
    FROM region_role rr
    INNER JOIN region
    ON region.id = rr.region_id
    WHERE guild_id = $1
    AND region.name = $2`,
    values: [guildId, regionName],
  };

  const getResult = await (client ?? db).query(getQuery);

  return getResult.rows[0];
};

const getByGuild = async (guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT * FROM region_role
    WHERE guild_id = $1
    `,
    values: [guildId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const create = async (roleDiscordId, regionId, guildId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO region_role (region_id, guild_id, discord_id)
    VALUES ($1, $2, $3)
    `,
    values: [regionId, guildId, roleDiscordId],
  };

  await (client ?? db).query(insertQuery);
};

const update = async (roleDiscordId, regionId, guildId, client = null) => {
  const updateQuery = {
    text: `UPDATE region_id
    SET discord_id = $1
    WHERE region_id = $2
    AND guild_id = $3`,
    values: [roleDiscordId, regionId, guildId],
  };

  await (client ?? db).query(updateQuery);
};

module.exports = {
  get,
  getByRegion,
  getByName,
  getByGuild,
  create,
  update,
};
