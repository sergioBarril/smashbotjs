const { CustomError } = require("./customError");

class SamePlayerError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `SamePlayerError`;

    if (message == null) {
      this.message = "Oye, que esta es **TU** partida. Ya aparecerá alguien para jugarte...";
    }
  }
}

module.exports = { SamePlayerError };
