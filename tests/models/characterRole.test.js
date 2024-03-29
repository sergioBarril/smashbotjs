const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertCharacter, getCharacterByName } = require("../../models/character");
const { CharacterRole, getCharacterRole } = require("../../models/characterRole");
const { insertGuild, getGuild } = require("../../models/guild");

afterAll(async () => await db.close());

describe("test characterRole methods", () => {
  let character;
  let guild;

  const mockRoleDiscordId = "123456";
  const mockGuildDiscordId = "843516697";

  const characterName = "Fortnite Guy";
  const characterName2 = "Hornet";

  beforeEach(async () => {
    character = await getCharacterByName(characterName);
    if (!character) character = await insertCharacter(characterName);

    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);
  });

  afterEach(async () => {
    character = await getCharacterByName(characterName);
    if (character) await character.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("inserts a new characterRole", async () => {
    const charRole = await character.insertRole(mockRoleDiscordId, guild.id);

    expect(charRole).not.toBeNull();
    expect(charRole instanceof CharacterRole).toBe(true);
    expect(charRole.roleId).toBe(mockRoleDiscordId);
    expect(charRole.characterId).toBe(character.id);
    expect(charRole.guildId).toBe(guild.id);
  });

  it("doesnt allow two characterRoles in the same guild", async () => {
    await expect(character.insertRole(mockRoleDiscordId, guild.id)).resolves.not.toBeNull();

    await expect(
      async () => await character.insertRole(mockRoleDiscordId, guild.id)
    ).rejects.toThrow();
  });

  it("doesnt allow two characterRoles with the same discordId", async () => {
    const secondChar = await insertCharacter(characterName2);
    expect(secondChar).not.toBeNull();

    await expect(secondChar.insertRole(mockRoleDiscordId, guild.id)).resolves.not.toBeNull();

    await expect(
      async () => await character.insertRole(mockRoleDiscordId, guild.id)
    ).rejects.toThrow();

    // Cleanup
    await secondChar.remove();
  });

  it("can get a character role by character and guild", async () => {
    expect(await character.getRole(guild.id)).toBeNull();
    expect(character.insertRole(mockRoleDiscordId, guild.id)).resolves.not.toBeNull();

    const charRole = await character.getRole(guild.id);
    expect(charRole).not.toBeNull();
    expect(charRole instanceof CharacterRole).toBe(true);
  });

  it("can get a character role by role discordId", async () => {
    const createdRole = await character.insertRole(mockRoleDiscordId, guild.id);

    const charRole = await getCharacterRole(mockRoleDiscordId);
    expect(charRole).not.toBeNull();
    expect(charRole.id).toBe(createdRole.id);
  });

  it("removes character roles when character is deleted", async () => {
    await character.insertRole(mockRoleDiscordId, guild.id);
    expect(await getCharacterRole(mockRoleDiscordId)).not.toBeNull();
    await character.remove();
    expect(await getCharacterRole(mockRoleDiscordId)).toBeNull();
  });

  it("gets character roles for the guild", async () => {
    let crs = await guild.getCharacterRoles();
    expect(crs.length).toBe(0);

    const charRole = await character.insertRole(mockRoleDiscordId, guild.id);

    crs = await guild.getCharacterRoles();
    expect(crs.length).toBe(1);
    const charRoleFromGet = crs[0];
    expect(charRoleFromGet instanceof CharacterRole).toBe(true);
    expect(JSON.stringify(charRoleFromGet)).toEqual(JSON.stringify(charRole));
  });

  it("gets character role by char name in a guild", async () => {
    let crFromGet = await guild.getCharacterRoleByName(characterName);
    expect(crFromGet).toBeNull();

    crFromGet = await guild.getCharacterRoleByName(characterName2);
    expect(crFromGet).toBeNull();

    const charRole = await character.insertRole(mockRoleDiscordId, guild.id);

    crFromGet = await guild.getCharacterRoleByName(characterName);
    expect(crFromGet instanceof CharacterRole).toBe(true);
    expect(JSON.stringify(crFromGet)).toEqual(JSON.stringify(charRole));
  });

  it("can set the role discord Id", async () => {
    let charRole = await character.insertRole(mockRoleDiscordId, guild.id);

    expect(charRole.roleId).toEqual(mockRoleDiscordId);

    const newRoleId = "8911939";
    await charRole.setRoleId(newRoleId);
    expect(charRole.roleId).toEqual(newRoleId);

    charRole = await guild.getCharacterRoleByName(characterName);
    expect(charRole.roleId).toEqual(newRoleId);
  });
});
