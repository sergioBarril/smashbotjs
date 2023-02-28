const { CustomError } = require("./customError");

class AlreadyWinnerError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `AlreadyWinnerError`;

    if (message == null) {
      this.message = `¡Ya habíais decidido el ganador!`;
    }
  }
}

module.exports = { AlreadyWinnerError };
