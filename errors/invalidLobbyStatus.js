const { CustomError } = require("./customError");

class InvalidLobbyStatusError extends CustomError {
  constructor(currentStatus, expectedStatus, message = null) {
    super(message);
    this.name = `InvalidLobbyStatusError`;

    if (message == null) {
      this.message = `Esperábamos un lobby con status ${expectedStatus}, ¡pero este tiene ${currentStatus}!`;
    }
  }
}

module.exports = { InvalidLobbyStatusError };
