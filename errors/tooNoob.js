const { CustomError } = require("./customError");

class TooNoobError extends CustomError {
  constructor(playerTierId, targetTierId, message = null) {
    super(message);
    this.name = `TooNoobError`;

    if (message == null)
      this.message = `¡No puedes jugar en <@&${targetTierId}> siendo <@&${playerTierId}>!`;
  }
}

module.exports = { TooNoobError };
