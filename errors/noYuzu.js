const { CustomError } = require("./customError");

class NoYuzuError extends CustomError {
  constructor(yuzuRoleId, parsecRoleId, message = null) {
    super(message);
    this.name = `NoYuzuError`;

    if (message == null)
      this.message = `¡No puedes jugar Yuzu sin los roles de <@&${yuzuRoleId}> o <@&${parsecRoleId}>!`;
  }
}

module.exports = { NoYuzuError };
