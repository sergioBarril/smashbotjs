const { CustomError } = require("./customError");

class CharacterNameError extends CustomError {
  constructor(characterName, message = null) {
    super(message);
    this.name = `CharacterNameError`;

    if (message == null) {
      this.message = `No he encontrado el personaje _${characterName}_. ¿Lo has escrito bien?`;
    }
  }
}

module.exports = { CharacterNameError };
