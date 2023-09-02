import { Client, Collection } from "discord.js";
import { Command } from "../interfaces/command";

export default class CustomClient extends Client {
  public commands: Collection<string, Command>;
}
