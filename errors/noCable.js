class NoCableError extends Error {
  constructor(message = null) {
    super(message);
    this.name = `NoCableError`;

    if (message == null)
      this.message = `¡No tienes ninguna tier asignada! No puedes buscar partida aquí.`;
  }
}

module.exports = { NoCableError };
