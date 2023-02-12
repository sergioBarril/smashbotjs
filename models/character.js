const { CharacterRole } = require("./characterRole");
const db = require("./db");

class Character {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  // **********
  //  GETTERS
  // **********
  getRole = async (guildId, client = null) => {
    const role = await db.getBy(
      "character_role",
      { character_id: this.id, guild_id: guildId },
      client
    );

    if (role == null) return null;
    else return new CharacterRole(role);
  };

  remove = async (client = null) => await db.basicRemove("character", this.id, false, client);

  insertRole = async (roleDiscordId, guildId, client = null) => {
    const insertQuery = {
      text: `
    INSERT INTO character_role (character_id, guild_id, role_id)
    VALUES ($1, $2, $3)
    `,
      values: [this.id, guildId, roleDiscordId],
    };

    await db.insertQuery(insertQuery, client);
    return await this.getRole(guildId, client);
  };
}

const getCharacter = async (characterId, client = null) => {
  const character = await db.basicGet("character", characterId, false, client);
  if (character == null) return null;
  else return new Character(character);
};

const getCharacterByName = async (charName, client = null) => {
  const character = await db.getBy("character", { name: charName }, client);
  if (character == null) return null;
  else return new Character(character);
};

const getAllCharacters = async (client = null) => {
  const getAllCharsQuery = { text: `SELECT * FROM character` };

  const getAllCharsResult = await db.getQuery(getAllCharsQuery, client, true);
  return getAllCharsResult.map((row) => new Character(row));
};

const insertCharacter = async (characterName, client = null) => {
  const insertChar = {
    text: `INSERT INTO character(name) VALUES ($1)`,
    values: [characterName],
  };

  await db.insertQuery(insertChar, client);
  return await getCharacterByName(characterName, client);
};

module.exports = {
  getCharacter,
  getCharacterByName,
  getAllCharacters,
  insertCharacter,
  Character,
};
