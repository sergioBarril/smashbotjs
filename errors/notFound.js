const { CustomError } = require("./customError");

class NotFoundError extends CustomError {
  constructor(type, message = null) {
    super(message);

    const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
    this.name = `${capitalized}NotFoundError`;

    if (message == null) this.message = `${capitalized} not found.`;
  }
}

module.exports = { NotFoundError };
