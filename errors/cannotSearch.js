class CannotSearchError extends Error {
  constructor(status, mode, message = null) {
    super(message);
    this.name = `CannotSearchError`;

    if (message == null) {
      const action = mode == "SEARCH" ? "buscar partida" : "cancelar la búsqueda";

      if (status === "CONFIRMATION" || status === "WAITING")
        this.message =
          `No puedes ${action} porque ya has encontrado.\n` +
          `Espera a que tu rival confirme o confirma/rechaza tú.`;
      else if (status === "PLAYING")
        this.message =
          `No puedes ${action} porque ya tienes una arena abierta.\n` +
          `Cierra la arena en la que estés y vuelve a intentarlo.`;
    }
  }
}

module.exports = { CannotSearchError };
