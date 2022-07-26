const { getCharacter } = require("./character");
const db = require("./db");

class CharacterPlayer {
  constructor({ character_id, player_id, type }) {
    this.characterId = character_id;
    this.playerId = player_id;
    this.type = type;
  }
  // **********
  //  GETTERS
  // *********
  getCharacterName = async (client = null) => {
    const character = await getCharacter(this.characterId, client);
    return character?.name;
  };

  // ***********
  //   SETTER
  // **********

  setType = async (type, client = null) => {
    const whereCondition = { character_id: this.characterId, player_id: this.playerId };
    await db.updateBy("character_player", { type }, whereCondition, client);
    this.type = type;
  };

  remove = async (client = null) => {
    const removeQuery = {
      text: `
    DELETE FROM character_player
    WHERE character_id = $1
    AND player_id = $2
    `,
      values: [this.characterId, this.playerId],
    };
    await db.deleteQuery(removeQuery, client);
  };
}

const insertCharacterPlayer = async (characterId, playerId, type, client = null) => {
  const insertQuery = {
    text: `
    INSERT INTO character_player (character_id, player_id, type)
    VALUES ($1, $2, $3)
    `,
    values: [characterId, playerId, type],
  };
  await db.insertQuery(insertQuery, client);
};

module.exports = {
  insertCharacterPlayer,
  CharacterPlayer,
};
