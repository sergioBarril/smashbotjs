export type MainType = "MAIN" | "SECOND" | "POCKET";
export type MainAction = "CREATED" | "UPDATED" | "DELETED";

export type Character = {
  id: number;
  name: string;
  emoji?: string;
};
