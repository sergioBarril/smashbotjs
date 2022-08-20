const { CustomError } = require("./customError");

class RegionNameError extends CustomError {
  constructor(regionName, message = null) {
    super(message);
    this.name = `RegionNameError`;

    if (message == null) {
      this.message = `No he encontrado la región _${regionName}_. ¿Lo has escrito bien?`;
    }
  }
}

module.exports = { RegionNameError };
