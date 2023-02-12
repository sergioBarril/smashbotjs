const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const {
  Character,
  insertCharacter,
  getCharacterByName,
  getAllCharacters,
  getCharacter,
} = require("../../models/character");

afterAll(async () => await db.close());

describe("test character methods", () => {
  let character;
  const characterName = "Fortnite Guy";

  beforeEach(async () => {
    character = await getCharacterByName(characterName);
    if (!character) character = await insertCharacter(characterName);
  });

  afterEach(async () => {
    character = await getCharacterByName(characterName);
    if (character) await character.remove();
  });

  it("inserts a new character", async () => {
    // Before
    character = await getCharacterByName(characterName);
    if (character != null) await character.remove();

    const numRows = await db.countRows("character");

    character = await insertCharacter(characterName);
    const newNumRows = await db.countRows("character");

    expect(newNumRows).toBe(numRows + 1);

    expect(character).not.toBe(null);
    expect(character.name).toBe(characterName);

    // Cleanup
    await character.remove();
    const finalNumRows = await db.countRows("character");
    expect(finalNumRows).toBe(numRows);
  });

  it("gets all characters", async () => {
    const allChars = await getAllCharacters();
    allChars.forEach((char) => {
      expect(char instanceof Character).toBe(true);
    });

    const numRows = await db.countRows("character");
    expect(numRows).toBe(allChars.length);
  });

  it("can't have two characters with the same name", async () => {
    expect(insertCharacter(characterName)).rejects.toThrow();
  });

  it("can get a character by Id", async () => {
    const charFromGet = await getCharacter(character.id);
    expect(JSON.stringify(charFromGet)).toEqual(JSON.stringify(character));
  });

  it("returns null if trying to get a char that doesn't exist", async () => {
    let charFromGet = await getCharacter(0);
    expect(charFromGet).toBeNull();

    charFromGet = await getCharacter(null);
    expect(charFromGet).toBeNull();
  });
});
