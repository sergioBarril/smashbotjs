const db = require("./db");

class CharacterRole {
  constructor({ id, discord_id, guild_id, character_id }) {
    this.id = id;
    this.discordId = discord_id;

    this.guildId = guild_id;
    this.characterId = character_id;
  }

  // ***********
  //   SETTER
  // **********
  setDiscordId = async (roleDiscordId, client = null) => {
    await db.updateBy("character_role", { discord_id: roleDiscordId }, { id: this.id }, client);
    this.discordId = roleDiscordId;
  };
}

const getCharacterRole = async (roleId, discord = false, client = null) => {
  const charRole = await db.basicGet("character_role", roleId, discord, client);
  if (charRole == null) return null;
  else return new CharacterRole(charRole);
};

module.exports = {
  getCharacterRole,
  CharacterRole,
};
