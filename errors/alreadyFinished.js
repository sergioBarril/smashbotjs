const { CustomError } = require("./customError");

class AlreadyFinishedError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `AlreadyFinishedError`;

    if (message == null) {
      this.message = `¡El set ya ha acabado! Ya tiene un ganador marcado.`;
    }
  }
}

module.exports = { AlreadyFinishedError };
