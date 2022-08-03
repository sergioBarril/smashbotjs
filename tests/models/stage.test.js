const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");

const {
  getStageByName,
  insertStage,
  Stage,
  getStarters,
  getAllStages,
  getStage,
} = require("../../models/stage");

afterAll(async () => await db.close());

describe("test stage methods", () => {
  let stage;
  let stage2;

  const stageName = "Starter Stage";
  const stage2Name = "CP Stage";

  beforeEach(async () => {
    stage = await getStageByName(stageName);
    if (!stage) stage = await insertStage(stageName, true);

    stage2 = await getStageByName(stage2Name);
    if (!stage2) stage2 = await insertStage(stage2Name, false);
  });

  afterEach(async () => {
    stage = await getStageByName(stageName);
    if (stage) await stage.remove();

    stage2 = await getStageByName(stageName);
    if (stage2) await stage2.remove();
  });

  it("inserts a new stage", async () => {
    expect(stage).not.toBeNull();
    expect(stage instanceof Stage).toBe(true);

    expect(stage.id).not.toBeNull();
    expect(stage.name).toBe(stageName);
    expect(stage.starter).toBe(true);
  });

  it("gets a stage by id", async () => {
    let stageFromGet = await getStage(stage.id);
    expect(stageFromGet instanceof Stage).toBe(true);
    expect(JSON.stringify(stageFromGet)).toEqual(JSON.stringify(stage));

    stageFromGet = await getStage(null);
    expect(stageFromGet).toBeNull();
  });

  it("gets starters", async () => {
    const starters = await getStarters();
    expect(starters.length).toEqual(6);
    expect(starters[0] instanceof Stage).toBe(true);
    expect(starters.some((stg) => JSON.stringify(stg) === JSON.stringify(stage))).toBe(true);
  });

  it("gets all stages", async () => {
    const stages = await getAllStages();
    expect(stages.length).toEqual(9);
    expect(stages.some((starter) => JSON.stringify(starter) === JSON.stringify(stage))).toBe(true);
    expect(stages.some((cp) => JSON.stringify(cp) === JSON.stringify(stage2))).toBe(true);
  });
});
