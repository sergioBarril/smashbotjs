import { Events } from "discord.js";

import CustomClient from "../config/custom-client";
import { Event } from "../interfaces/event";
import logger from "../config/logger";

const onReady: Event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: CustomClient) {
    const { user } = client;
    if (user) logger.info(`Ready! Logged in as ${user.tag}`);
    else logger.info("Ready! Logged in as a userless client");
  },
};

export default onReady;
