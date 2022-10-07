const { CustomError } = require("./customError");

class MessageTypeError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `MessageTypeError`;

    if (message == null) {
      this.message = `El mensaje encontrado no es del tipo que se esperaba.`;
      this.log = true;
    }
  }
}

module.exports = { MessageTypeError };
