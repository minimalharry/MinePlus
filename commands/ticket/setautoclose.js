const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'setautoclose',
  description: 'Set inactivity auto-close time in minutes (0 disables)',
  options: [
    {
      name: 'minutes',
      description: 'Inactivity minutes before auto close',
      type: 'integer',
      required: true
    }
  ],
  async execute(interaction, manager) {
    if (!interaction.memberPermissions?.has('ManageGuild') && !interaction.memberPermissions?.has('ManageChannels')) {
      return interaction.reply({ content: 'You need Manage Server or Manage Channels permission.', flags: MessageFlags.Ephemeral });
    }

    const minutes = interaction.options.getInteger('minutes', true);
    if (minutes < 0 || minutes > 10080) {
      return interaction.reply({ content: 'Minutes must be between 0 and 10080.', flags: MessageFlags.Ephemeral });
    }

    const ticketSystem = await manager.getTicketSystem(interaction.guildId);
    ticketSystem.settings.autoCloseMinutes = minutes === 0 ? 100000000 : minutes;
    await manager.saveTicketSystem(interaction.guildId, ticketSystem);

    return interaction.reply({
      content: minutes === 0
        ? '✅ Auto-close disabled.'
        : `✅ Auto-close set to ${minutes} minute(s).`,
      flags: MessageFlags.Ephemeral
    });
  }
};
