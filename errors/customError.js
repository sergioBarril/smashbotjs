class CustomError extends Error {
  constructor(message = null) {
    super(message);
  }
}

module.exports = { CustomError };
