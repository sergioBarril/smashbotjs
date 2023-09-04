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
