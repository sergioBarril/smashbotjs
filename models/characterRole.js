const db = require("./db");

class CharacterRole {
  constructor({ id, discord_id, guild_id, character_id }) {
    this.id = id;
    this.discordId = discord_id;

    this.guildId = guild_id;
    this.chracterId = character_id;
  }

  // ***********
  //   SETTER
  // **********
  setDiscordId = async (roleDiscordId, client = null) => {
    await db.updateBy("character_role", { discord_id: roleDiscordId }, { id: this.id }, client);
    this.discordId = roleDiscordId;
  };
}

const getCharacterRole = async (roleId, discord = false, client = null) => {
  const charRole = await db.basicGet("character_role", roleId, discord, client);
  if (charRole == null) return null;
  else return CharacterRole(charRole);
};

const insertCharacterRole = async (roleDiscordId, characterId, guildId, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO character_role (character_id, guild_id, discord_id)
    VALUES ($1, $2, $3)
    `,
    values: [characterId, guildId, roleDiscordId],
  };

  await db.insertQuery(insertQuery, client);
};

module.exports = {
  getCharacterRole,
  insertCharacterRole,
  CharacterRole,
};
