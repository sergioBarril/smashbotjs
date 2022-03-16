const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageButton } = require("discord.js");
const db = require("../db");

const command = new SlashCommandBuilder()
  .setName("make")
  .setDescription("Set up a part of the server!")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("tier")
      .setDescription("Setup a new tier")
      .addStringOption((option) => option.setName("name").setDescription("The name"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("button")
      .setDescription("Make a button")
      .addChannelOption((option) => option.setName("channel").setDescription("Channel "))
      .addStringOption((option) => option.setName("name").setDescription("Name of the tier"))
  );

module.exports = {
  data: command,
  async execute(interaction) {
    if (interaction.options.getSubcommand() === "tier") {
      const { guild, guildId } = interaction;
      const result = await db
        .query("SELECT search_channel_id AS channel_id FROM guild WHERE discord_id = $1", [guildId])
        .catch((err) => console.error(err));
      const channel_id = result.rows[0].channel_id;
      const channel = await guild.channels.fetch(channel_id);
      const message = await channel.send("La tier es.... 3!");
      await interaction.reply(`TIER BABY. Channel id: ${channel_id}`);
    } else if (interaction.options.getSubcommand() === "button") {
      const { guild, guildId } = interaction;
      const channel = interaction.options.getChannel("channel");
      const row = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("friendlies").setLabel("Friendlies").setStyle("SUCCESS"),
        new MessageButton().setCustomId("cancel-friendlies").setLabel("Cancel").setStyle("DANGER")
      );
      await channel.send({
        content: `**${interaction.options.getString("name")}**`,
        components: [row],
      });
    } else await interaction.reply("WIP?");
  },
};
