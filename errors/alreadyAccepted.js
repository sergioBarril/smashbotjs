const { CustomError } = require("./customError");

class AlreadyAcceptedError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `AlreadyAcceptedError`;

    if (message == null) {
      this.message = `¡Ya habías confirmado el match!`;
    }
  }
}

module.exports = { AlreadyAcceptedError };
