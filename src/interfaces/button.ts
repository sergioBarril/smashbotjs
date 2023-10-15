import { ButtonInteraction } from "discord.js";

export interface Button {
  data: { name: string };
  execute: (interaction: ButtonInteraction) => Promise<void>;
}
