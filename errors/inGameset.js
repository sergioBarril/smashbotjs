const { CustomError } = require("./customError");

class InGamesetError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `InGamesetError`;

    if (message == null) {
      this.message = `¡Estás jugando un set! Tenéis que acabarlo o cancelarlo antes de cerrar el lobby.`;
    }
  }
}

module.exports = { InGamesetError };
