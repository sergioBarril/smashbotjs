const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { NotFoundError } = require("../../../errors/notFound");

const {
  getOrCreatePlayer,
  getOrCreateCharacter,
  deleteIfExistsPlayer,
  deleteIfExistsCharacter,
  getOrCreateGuild,
} = require("../../utils/testingUtils");
const { assignCharacter, getCharacters } = require("../../../api/roles");

afterAll(async () => await db.close());

describe("test rolesAPI.assignCharacter() method", () => {
  let guild;
  const guildDiscordId = "85419049";

  let player;
  const playerDiscordId = "123456";

  let character1;
  const character1Name = "Testing 1";
  let character2;
  const character2Name = "Testing 2";
  let character3;
  const character3Name = "Testing 3";
  let character4;
  const character4Name = "Testing 4";

  let charRole1, charRole2, charRole3, charRole4;
  const charRole1Id = "851958129";
  const charRole2Id = "859159122";
  const charRole3Id = "851029032";
  const charRole4Id = "8510923028";

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    guild = await getOrCreateGuild(guildDiscordId);

    character1 = await getOrCreateCharacter(character1Name);
    character2 = await getOrCreateCharacter(character2Name);
    character3 = await getOrCreateCharacter(character3Name);
    character4 = await getOrCreateCharacter(character4Name);

    charRole1 = await character1.insertCharacterRole(charRole1Id, guild.id);
    charRole2 = await character2.insertCharacterRole(charRole2Id, guild.id);
    charRole3 = await character3.insertCharacterRole(charRole3Id, guild.id);
    charRole4 = await character4.insertCharacterRole(charRole4Id, guild.id);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsCharacter(character1Name);
    await deleteIfExistsCharacter(character2Name);
    await deleteIfExistsCharacter(character3Name);
    await deleteIfExistsCharacter(character4Name);
  });

  test("add character", async () => {
    const previousChars = await getCharacters(player.discordId);
    expect(previousChars.mains.length).toBe(0);
    expect(previousChars.seconds.length).toBe(0);
    expect(previousChars.pockets.length).toBe(0);

    await assignCharacter(player.discordId, character1Name, guild.discordId, "MAIN");

    const newChars = await getCharacters(player.discordId);
    expect(newChars.mains.length).toBe(1);
    expect(newChars.seconds.length).toBe(0);
    expect(newChars.pockets.length).toBe(0);
  });

  test("remove character", async () => {
    await assignCharacter(player.discordId, character1Name, guild.discordId, "MAIN");
    const previousChars = await getCharacters(player.discordId);
    expect(previousChars.mains.length).toBe(1);
    expect(previousChars.seconds.length).toBe(0);
    expect(previousChars.pockets.length).toBe(0);
    await assignCharacter(player.discordId, character1Name, guild.discordId, "MAIN");

    const newChars = await getCharacters(player.discordId);
    expect(newChars.mains.length).toBe(0);
    expect(newChars.seconds.length).toBe(0);
    expect(newChars.pockets.length).toBe(0);
  });

  test("update character", async () => {
    await assignCharacter(player.discordId, character1Name, guild.discordId, "MAIN");
    const previousChars = await getCharacters(player.discordId);
    expect(previousChars.mains.length).toBe(1);
    expect(previousChars.seconds.length).toBe(0);
    expect(previousChars.pockets.length).toBe(0);
    await assignCharacter(player.discordId, character1Name, guild.discordId, "POCKET");

    let newChars = await getCharacters(player.discordId);
    expect(newChars.mains.length).toBe(0);
    expect(newChars.seconds.length).toBe(0);
    expect(newChars.pockets.length).toBe(1);

    await assignCharacter(player.discordId, character1Name, guild.discordId, "SECOND");

    newChars = await getCharacters(player.discordId);
    expect(newChars.mains.length).toBe(0);
    expect(newChars.seconds.length).toBe(1);
    expect(newChars.pockets.length).toBe(0);
  });

  test("throws NotFoundError if player not found", async () => {
    await player.remove();
    await expect(
      assignCharacter(player.discordId, character1Name, guild.discordId, "MAIN")
    ).rejects.toThrow(new NotFoundError("Player"));
  });

  test("throws NotFoundError if guild not found", async () => {
    await guild.remove();
    await expect(
      assignCharacter(player.discordId, character1Name, guild.discordId, "MAIN")
    ).rejects.toThrow(new NotFoundError("Guild"));
  });

  test("throws NotFoundError if character not found", async () => {
    await expect(
      assignCharacter(player.discordId, "Not valid character", guild.discordId, "MAIN")
    ).rejects.toThrow(new NotFoundError("Character"));
  });
});
