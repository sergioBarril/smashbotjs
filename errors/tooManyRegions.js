const { CustomError } = require("./customError");
const spanishRegions = require("../params/spanishRegions.json");

class TooManyRegionsError extends CustomError {
  constructor(currentRegions, message = null) {
    super(message);
    this.name = `TooManyRegionsError`;

    if (message == null) {
      const listFormatter = new Intl.ListFormat("es", {
        style: "long",
        type: "conjunction",
      });

      const listString = listFormatter.format(
        currentRegions.map((reg) => `**${reg.name}** ${spanishRegions[reg.name].emoji}`)
      );

      this.message = `El máximo de regiones son 2. Ya tienes 2 regiones asignadas: ${listString}.`;
    }
  }
}

module.exports = { TooManyRegionsError };
