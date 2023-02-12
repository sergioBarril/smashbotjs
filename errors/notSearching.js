const { CustomError } = require("./customError");

class NotSearchingError extends CustomError {
  constructor(tierDiscordId, isYuzu, message = null) {
    super(message);
    this.name = `NotSearchingError`;

    if (message == null) {
      if (tierDiscordId == null)
        this.message = `¡No estabas buscando partida en ninguna tier con cable LAN!`;
      else if (isYuzu) this.message = `¡No estabas buscando partida en **Yuzu**!`;
      else this.message = `¡No estabas buscando partida en <@&${tierDiscordId}>!`;
    }
  }
}

module.exports = { NotSearchingError };
