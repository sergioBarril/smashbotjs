const db = require("./db");

class CharacterRole {
  constructor({ id, role_id, guild_id, character_id }) {
    this.id = id;
    this.roleId = role_id;

    this.guildId = guild_id;
    this.characterId = character_id;
  }

  // ***********
  //   SETTER
  // **********
  setRoleId = async (roleDiscordId, client = null) => {
    await db.updateBy("character_role", { role_id: roleDiscordId }, { id: this.id }, client);
    this.roleId = roleDiscordId;
  };
}

const getCharacterRole = async (roleDiscordId, client = null) => {
  const charRole = await db.getBy("character_role", { role_id: roleDiscordId }, client);
  if (charRole == null) return null;
  else return new CharacterRole(charRole);
};

module.exports = {
  getCharacterRole,
  CharacterRole,
};
