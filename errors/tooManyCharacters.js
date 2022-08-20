const { CustomError } = require("./customError");
const smashCharacters = require("../params/smashCharacters.json");

class TooManyCharactersError extends CustomError {
  constructor(type, currentCharacters, message = null) {
    super(message);
    this.name = `TooManyRolesError`;

    if (message == null) {
      const listFormatter = new Intl.ListFormat("es", {
        style: "long",
        type: "conjunction",
      });

      const listString = listFormatter.format(
        currentCharacters.map((char) => `**${char.name}** ${smashCharacters[char.name].emoji}`)
      );

      if (type === "MAIN")
        this.message = `El máximo de mains son 2. Ya tienes 2 mains asignados: ${listString}.`;
      else if (type === "SECOND")
        this.message = `El máximo de seconds son 3. Ya tienes 3 seconds asignados: ${listString}.`;
      else
        this.message = `El máximo de pockets son 5. Ya tienes 5 pockets asignados: ${listString}.`;
    }
  }
}

module.exports = { TooManyCharactersError };
