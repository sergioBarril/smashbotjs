const db = require("./db");

class YuzuPlayer {
  constructor({ id, guild_id, player_id, yuzu, parsec, parsec_name }) {
    this.id = id;
    this.guildId = guild_id;
    this.playerId = player_id;
    this.yuzu = yuzu;
    this.parsec = parsec;
    this.parsecName = parsec_name;
  }

  setYuzu = async (yuzu, client = null) => {
    await db.updateBy("yuzu_player", { yuzu }, { id: this.id }, client);
    this.yuzu = yuzu;
  };

  setParsec = async (parsec, client = null) => {
    await db.updateBy("yuzu_player", { parsec }, { id: this.id }, client);
    this.parsec = parsec;
  };

  setParsecName = async (parsecName, client = null) => {
    await db.updateBy("yuzu_player", { parsec_name: parsecName }, { id: this.id }, client);
    this.parsecName = parsecName;
  };
}

module.exports = {
  YuzuPlayer,
};
