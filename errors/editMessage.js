class EditMessageError extends Error {
  constructor(message = null) {
    super(message);
    this.name = `EditMessageError`;

    if (message == null) {
      this.message = `Ha habido un error al editar un mensaje.`;
    }
  }
}

module.exports = { EditMessageError };
