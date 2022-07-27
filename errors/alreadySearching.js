class AlreadySearchingError extends Error {
  constructor(tierDiscordId, isYuzu, message = null) {
    super(message);
    this.name = `AlreadySearchingError`;

    if (message == null) {
      if (isYuzu) this.message = `¡Ya estabas buscando partida en **Yuzu**!`;
      else this.message = `¡Ya estabas buscando partida en <@&${tierDiscordId}>!`;
    }
  }
}

module.exports = { AlreadySearchingError };
