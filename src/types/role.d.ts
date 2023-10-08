export type RoleType =
  | "ADMIN"
  | "PANELIST"
  | "TIER"
  | "CHARACTER"
  | "REGION"
  | "CABLE"
  | "NO_CABLE";

export type Role = {
  id: number;
  discordId: string;
  type: RoleType;
  guildId: number;
  characterId?: number | null;
  color?: string | null;
  regionId?: number | null;
};

export type CharacterRole = {
  id: string;
  type: "CHARACTER";
  characterId: number;
  color?: string | null;
};
