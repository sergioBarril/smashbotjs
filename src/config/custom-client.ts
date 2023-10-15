import { Client, Collection } from "discord.js";
import { Command } from "../interfaces/command";
import { Button } from "../interfaces/button";

export default class CustomClient extends Client {
  public commands: Collection<string, Command>;

  public buttons: Collection<string, Button>;
}
