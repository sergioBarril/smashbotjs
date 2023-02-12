const { CustomError } = require("./customError");

class IncomaptibleYuzuError extends CustomError {
  constructor(playerYuzuRoleId, expectedYuzuRoleId, message = null) {
    super(message);
    this.name = `IncompatibleYuzuError`;

    if (message == null) {
      this.message = `Esta persona está buscando a alguien que tenga el rol <@&${expectedYuzuRoleId}>, pero tú tienes <@&${playerYuzuRoleId}!>`;
    }
  }
}

module.exports = { IncomaptibleYuzuError };
