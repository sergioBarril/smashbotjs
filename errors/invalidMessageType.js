const { CustomError } = require("./customError");

class InvalidMessageTypeError extends CustomError {
  constructor(receivedType, expectedType, message = null) {
    super(message);
    this.name = `InvalidMessageTypeError`;

    if (message == null) {
      this.message = `Esperábamos un mensaje de tipo ${expectedType}, ¡pero este tiene ${receivedType}!`;
    }
  }
}

module.exports = { InvalidMessageTypeError };
