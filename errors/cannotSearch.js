class CannotSearchError extends Error {
  constructor(status, message = null) {
    super(message);
    this.name = `CannotSearchError`;

    if (message == null) {
      if (status === "CONFIRMATION" || status === "WAITING")
        this.message =
          `No puedes buscar partida porque ya has encontrado una.\n` +
          `Espera a que tu rival confirme o confirma/rechaza tú.`;
      else if (status === "PLAYING")
        this.message =
          `No puedes buscar partida porque ya tienes una abierta.\n` +
          `Cierra la arena en la que estés y vuelve a intentarlo.`;
    }
  }
}

module.exports = { CannotSearchError };
