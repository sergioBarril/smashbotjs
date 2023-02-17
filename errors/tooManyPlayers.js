const { CustomError } = require("./customError");

class TooManyPlayersError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `TooManyPlayersError`;

    if (message == null) {
      this.message = `De momento solo se pueden hacer salas con 2 personas.`;
    }
  }
}

module.exports = { TooManyPlayersError };
