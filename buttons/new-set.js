const { MessageActionRow, MessageButton, Interaction } = require("discord.js");
const winston = require("winston");
const setAPI = require("../api/gameSet");
const { setupCharacter, bonusSetText } = require("../utils/discordGameset");

const newSetButtons = (message, decided, status) => {
  const newButtons = message.components.map((row) => {
    const newRow = new MessageActionRow();
    row.components.forEach((button) => {
      if (decided && decided != 0) button.setDisabled(true);
      if (button.customId.startsWith("new-set")) {
        const bestOf = Number(button.customId.split("-").at(-1));
        const boStatus = status[bestOf];

        if (boStatus.every((playerVote) => playerVote)) {
          button.setStyle("SUCCESS");
        } else if (boStatus.some((playerVote) => playerVote)) button.setStyle("PRIMARY");
        else button.setStyle("SECONDARY");
      }
      newRow.addComponents(button);
    });
    return newRow;
  });

  return newButtons;
};

/**
 * Reply in case only one player has requested a new set
 * @param {Interaction} interaction DiscordJS interaction
 * @param {boolean} status True if requested a new set, False if cancelling the request
 * @param {string} opponentDiscordId Discord ID of the opponent
 * @param {int} bestOf Whether this is BO3, BO5...
 */
const firstVote = async (interaction, status, opponentDiscordId, bestOf) => {
  const player = interaction.member;
  const opponent = await interaction.guild.members.fetch(opponentDiscordId);

  if (status[bestOf].some((playerVote) => playerVote)) {
    winston.info(`${player.displayName} quiere jugar un set BO${bestOf}.`);
    await interaction.editReply(
      `${player.displayName} quiere jugar un set BO${bestOf}. ${opponent}, ¡dale tú también al botón si quieres jugar!`
    );
  } else {
    winston.info(`${player.displayName} ya no quiere jugar un set BO${bestOf}.`);
    await interaction.editReply(`**${player.displayName}** ya no quiere jugar un set BO${bestOf}.`);
  }
};

const cancelSetButtons = () => {
  return [
    new MessageActionRow().addComponents(
      new MessageButton().setCustomId("cancel-set").setStyle("SECONDARY").setLabel("Anular set")
    ),
  ];
};

module.exports = {
  data: { name: "new-set" },
  async execute(interaction) {
    const channel = interaction.channel;
    const customId = interaction.customId.split("-");

    const bestOf = Number(customId.at(-1));
    const isRanked = customId.at(-2) === "ranked";

    const { decided, status, opponent } = await setAPI.voteNewSet(interaction.user.id, bestOf);

    await interaction.deferReply();
    await interaction.message.edit({
      components: newSetButtons(interaction.message, decided, status),
    });

    if (!decided || decided == 0)
      return await firstVote(interaction, status, opponent.discordId, bestOf);

    const firstTo = Math.ceil(bestOf / 2);
    const { players } = await setAPI.newSet(interaction.channel.id, firstTo);

    const members = await Promise.all(
      players.map(async (p) => await interaction.guild.members.fetch(p.discordId))
    );

    const memberFormatter = new Intl.ListFormat("es");
    const memberNames = memberFormatter.format(
      members.map((member) => `**${member.displayName}**`)
    );

    winston.info(`Empieza un set entre ${memberNames}.`);

    let bonusText = "";
    if (isRanked) {
      bonusText = await bonusSetText(
        interaction.user.id,
        opponent.discordId,
        interaction.guild.id,
        members
      );
    }

    await interaction.editReply({
      content: `¡Marchando un set BO${bestOf} entre ${memberNames}! ${bonusText}\nSi hay algún problema y ambos estáis de acuerdo en cancelar el set, pulsad el botón:`,
      components: cancelSetButtons(),
    });

    await interaction.channel.send("__**Game 1**__");

    await Promise.all([
      members.map((member) => setupCharacter(channel, member, 1, interaction.guild)),
    ]);
  },
};
