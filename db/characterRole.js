const db = require("./index");

const get = async (roleId, discord = false, client = null) =>
  await db.basicGet("character_role", roleId, discord, client);

const getByGuild = async (guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT * FROM character_role
    WHERE guild_id = $1
    `,
    values: [guildId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows;
};

const getByChar = async (charId, guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT * FROM character_role
    WHERE character_id = $1
    AND guild_id = $2
    `,
    values: [charId, guildId],
  };

  const getResult = await (client ?? db).query(getQuery);
  return getResult.rows[0];
};

const getByName = async (charName, guildId, client = null) => {
  const getQuery = {
    text: `
    SELECT cr.* 
    FROM character_role cr
    INNER JOIN character
    ON character.id = cr.character_id
    WHERE guild_id = $1
    AND character.name = $2`,
    values: [guildId, charName],
  };

  const getResult = await (client ?? db).query(getQuery);

  return getResult.rows[0];
};

const create = async (roleDiscordId, characterId, guildId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO character_role (character_id, guild_id, discord_id)
    VALUES ($1, $2, $3)
    `,
    values: [characterId, guildId, roleDiscordId],
  };

  await (client ?? db).query(insertQuery);
};

const update = async (roleDiscordId, characterId, guildId, client = null) => {
  const updateQuery = {
    text: `UPDATE character_role
    SET discord_id = $1
    WHERE character_id = $2
    AND guild_id = $3`,
    values: [roleDiscordId, characterId, guildId],
  };

  await (client ?? db).query(updateQuery);
};

module.exports = {
  get,
  getByChar,
  getByName,
  getByGuild,
  create,
  update,
};
