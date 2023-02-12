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

  getCharacter = async (client = null) => await getCharacter(this.characterId, client);

  getPlayer = async (client = null) => {
    const { getPlayer } = require("./player");
    return await getPlayer(this.playerId, false, client);
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

module.exports = {
  CharacterPlayer,
};
