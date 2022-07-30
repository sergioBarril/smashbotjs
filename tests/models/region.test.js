const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { Region, insertRegion, getRegionByName, getAllRegions } = require("../../models/region");

afterAll(async () => await db.close());

describe("test region methods", () => {
  let region;
  const mockRegionName = "Narnia";

  beforeEach(async () => {
    region = await getRegionByName(mockRegionName);
    if (!region) region = await insertRegion(mockRegionName);
  });

  afterEach(async () => {
    region = await getRegionByName(mockRegionName);
    if (region) await region.remove();
  });

  it("inserts a new region", async () => {
    // Before
    region = await getRegionByName(mockRegionName);
    if (region != null) await region.remove();

    const numRows = await db.countRows("region");
    region = await insertRegion(mockRegionName);
    const newNumRows = await db.countRows("region");

    expect(newNumRows).toBe(numRows + 1);

    expect(region).not.toBeNull();
    expect(region instanceof Region).toBe(true);
    expect(region.name).toEqual(mockRegionName);

    // Cleanup
    await region.remove();
    const finalNumRows = await db.countRows("region");
    expect(finalNumRows).toBe(numRows);
  });

  it("gets all regions", async () => {
    const allRegs = await getAllRegions();
    allRegs.forEach((reg) => {
      expect(reg instanceof Region).toBe(true);
    });

    const numRows = await db.countRows("region");
    expect(numRows).toBe(allRegs.length);
  });

  it("can't have two regions with the same name", async () => {
    expect(insertRegion(mockRegionName)).rejects.toThrow();
  });
});
