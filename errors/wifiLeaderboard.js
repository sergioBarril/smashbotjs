const { CustomError } = require("./customError");

class WifiLeaderboardError extends CustomError {
  constructor(message = null) {
    super(message);
    this.name = `WifiLeaderboardError`;

    if (message == null) {
      this.message = `¡No puedes ver la leaderboard de la **tier Wifi**!`;
    }
  }
}

module.exports = { WifiLeaderboardError };
