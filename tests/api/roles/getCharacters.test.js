const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { NotFoundError } = require("../../../errors/notFound");

const {
  getOrCreatePlayer,
  getOrCreateCharacter,
  deleteIfExistsPlayer,
  deleteIfExistsCharacter,
} = require("../../utils/testingUtils");
const { getCharacters } = require("../../../api/roles");

afterAll(async () => await db.close());

describe("test getCharacters method", () => {
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

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    character1 = await getOrCreateCharacter(character1Name);
    character2 = await getOrCreateCharacter(character2Name);
    character3 = await getOrCreateCharacter(character3Name);
    character4 = await getOrCreateCharacter(character4Name);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsCharacter(character1Name);
    await deleteIfExistsCharacter(character2Name);
    await deleteIfExistsCharacter(character3Name);
    await deleteIfExistsCharacter(character4Name);
  });

  it("if no characters assigned, return empty arrays", async () => {
    const result = await getCharacters(player.discordId);
    expect(result.mains.length).toEqual(0);
    expect(result.seconds.length).toEqual(0);
    expect(result.pockets.length).toEqual(0);
  });

  it("it returns mains, seconds and or pockets", async () => {
    await player.insertCharacter(character1.id, "MAIN");
    await player.insertCharacter(character2.id, "SECOND");
    await player.insertCharacter(character3.id, "SECOND");
    await player.insertCharacter(character4.id, "POCKET");

    const result = await getCharacters(player.discordId);
    expect(result.mains.length).toEqual(1);
    expect(result.seconds.length).toEqual(2);
    expect(result.pockets.length).toEqual(1);
  });

  it("throws if no player", async () => {
    await expect(getCharacters(null)).rejects.toThrow(NotFoundError);
    await player.remove();
    await expect(getCharacters(player.discordId)).rejects.toThrow(NotFoundError);
  });
});
