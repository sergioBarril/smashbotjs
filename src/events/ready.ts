import { Events } from "discord.js";

import CustomClient from "../config/custom-client";
import { Event } from "../interfaces/event";

const onReady: Event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: CustomClient) {
    const { user } = client;
    if (user) console.log(`Ready! Logged in as ${user.tag}`);
    else console.log("Ready! Logged in as a userless client");
  },
};

export default onReady;
