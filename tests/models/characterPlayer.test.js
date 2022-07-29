const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertCharacter, getCharacterByName, Character } = require("../../models/character");
const { getPlayer, insertPlayer, Player } = require("../../models/player");
const { CharacterPlayer } = require("../../models/characterPlayer");

afterAll(async () => await db.close());

describe("test characterPlayer methods", () => {
  let character;
  let player;
  let charPlayer;

  const characterName = "Fortnite Guy";
  const mockPlayerDiscordId = "147258369";

  beforeEach(async () => {
    character = await getCharacterByName(characterName);
    if (!character) character = await insertCharacter(characterName);

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    charPlayer = await player.insertCharacter(character.id, "MAIN");
  });

  afterEach(async () => {
    character = await getCharacterByName(characterName);
    if (character) await character.remove();

    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();
  });

  it("inserts a new characterPlayer", async () => {
    expect(charPlayer).not.toBeNull();
    expect(charPlayer instanceof CharacterPlayer).toBe(true);
    expect(charPlayer.playerId).toBe(player.id);
    expect(charPlayer.characterId).toBe(character.id);
    expect(charPlayer.type).toEqual("MAIN");
  });

  it("can only have types MAIN SECOND or POCKET", async () => {
    await charPlayer.remove();

    charPlayer = await player.insertCharacter(character.id, "MAIN");
    await charPlayer.remove();

    charPlayer = await player.insertCharacter(character.id, "SECOND");
    await charPlayer.remove();

    charPlayer = await player.insertCharacter(character.id, "POCKET");
    await charPlayer.remove();

    await expect(player.insertCharacter(character.id, "PATATA")).rejects.toThrow();
  });

  it("enforces (char, player) uniqueness", async () => {
    await charPlayer.remove();
    await expect(player.insertCharacter(character.id, "MAIN")).resolves.not.toBeNull();
    await expect(player.insertCharacter(character.id, "SECOND")).rejects.toThrow();
  });

  it("deleting the player deletes the characterPlayer", async () => {
    const beforeRows = await db.countRows("character_player");
    await player.remove();
    const afterRows = await db.countRows("character_player");
    expect(afterRows).toEqual(beforeRows - 1);
  });

  it("deleting the character deletes the characterPlayer", async () => {
    const beforeRows = await db.countRows("character_player");
    await character.remove();
    const afterRows = await db.countRows("character_player");
    expect(afterRows).toEqual(beforeRows - 1);
  });

  it("can get the character name", async () => {
    const charName = await charPlayer.getCharacterName();
    expect(charName).toEqual(characterName);
  });

  it("can get the character", async () => {
    const char = await charPlayer.getCharacter();

    expect(char instanceof Character).toBe(true);
    expect(char.id).toEqual(character.id);
    expect(char.name).toEqual(character.name);
  });

  it("can get the player", async () => {
    const p = await charPlayer.getPlayer();

    expect(p instanceof Player).toBe(true);
    expect(p.id).toEqual(player.id);
    expect(p.discordId).toEqual(player.discordId);
  });
});
