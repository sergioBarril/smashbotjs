const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertCharacter, getCharacterByName } = require("../../models/character");
const { CharacterRole, getCharacterRole } = require("../../models/characterRole");
const { getAllGuilds } = require("../../models/guild");

afterAll(async () => await db.close());

describe("test characterRole methods", () => {
  let character;
  let guild;

  const mockRoleDiscordId = "123456";

  const characterName = "Fortnite Guy";
  const characterName2 = "Hornet";

  beforeEach(async () => {
    character = await getCharacterByName(characterName);
    if (!character) character = await insertCharacter(characterName);

    if (!guild) {
      const guilds = await getAllGuilds();
      guild = guilds[0];
    }
  });

  afterEach(async () => {
    character = await getCharacterByName(characterName);
    if (character) await character.remove();
  });

  it("inserts a new characterRole", async () => {
    const charRole = await character.insertCharacterRole(mockRoleDiscordId, guild.id);

    expect(charRole).not.toBeNull();
    expect(charRole instanceof CharacterRole).toBe(true);
    expect(charRole.discordId).toBe(mockRoleDiscordId);
    expect(charRole.characterId).toBe(character.id);
    expect(charRole.guildId).toBe(guild.id);
  });

  it("doesnt allow two characterRoles in the same guild", async () => {
    await expect(
      character.insertCharacterRole(mockRoleDiscordId, guild.id)
    ).resolves.not.toBeNull();

    await expect(
      async () => await character.insertCharacterRole(mockRoleDiscordId, guild.id)
    ).rejects.toThrow();
  });

  it("doesnt allow two characterRoles with the same discordId", async () => {
    const secondChar = await insertCharacter(characterName2);
    expect(secondChar).not.toBeNull();

    await expect(
      secondChar.insertCharacterRole(mockRoleDiscordId, guild.id)
    ).resolves.not.toBeNull();

    await expect(
      async () => await character.insertCharacterRole(mockRoleDiscordId, guild.id)
    ).rejects.toThrow();

    // Cleanup
    await secondChar.remove();
  });

  it("can get a character role by character and guild", async () => {
    expect(await character.getRole(guild.id)).toBeNull();
    expect(character.insertCharacterRole(mockRoleDiscordId, guild.id)).resolves.not.toBeNull();

    const charRole = await character.getRole(guild.id);
    expect(charRole).not.toBeNull();
    expect(charRole instanceof CharacterRole).toBe(true);
  });

  it("can get a character role by role discordId", async () => {
    const createdRole = await character.insertCharacterRole(mockRoleDiscordId, guild.id);

    const charRole = await getCharacterRole(mockRoleDiscordId, true);
    expect(charRole).not.toBeNull();
    expect(charRole.id).toBe(createdRole.id);
  });

  it("removes character roles when character is deleted", async () => {
    await character.insertCharacterRole(mockRoleDiscordId, guild.id);
    expect(await getCharacterRole(mockRoleDiscordId, true)).not.toBeNull();
    await character.remove();
    expect(await getCharacterRole(mockRoleDiscordId, true)).toBeNull();
  });
});
