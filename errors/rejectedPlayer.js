const { CustomError } = require("./customError");

class RejectedPlayerError extends CustomError {
  constructor(rejecterPlayerDiscordId, message = null) {
    super(message);
    this.name = `RejectedPlayerError`;

    if (message == null)
      this.message = `¡<@${rejecterPlayerDiscordId}> te rechazó antes! Tiene que ser él/ella quien te pida partida a ti (o vuelve a intentarlo tú en una media hora)`;
  }
}

module.exports = { RejectedPlayerError };
