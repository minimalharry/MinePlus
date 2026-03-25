const { ChannelType, MessageFlags } = require('discord.js');

module.exports = {
  name: 'setlog',
  description: 'Set ticket transcript/log channel',
  options: [
    {
      name: 'channel',
      description: 'Text channel for ticket logs',
      type: 'channel',
      required: true
    }
  ],
  async execute(interaction, manager) {
    if (!interaction.memberPermissions?.has('ManageGuild') && !interaction.memberPermissions?.has('ManageChannels')) {
      return interaction.reply({ content: 'You need Manage Server or Manage Channels permission.', flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.options.getChannel('channel', true);
    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({ content: 'Please provide a text channel.', flags: MessageFlags.Ephemeral });
    }

    const ticketSystem = await manager.getTicketSystem(interaction.guildId);
    ticketSystem.settings.logChannelId = channel.id;
    await manager.saveTicketSystem(interaction.guildId, ticketSystem);

    return interaction.reply({ content: `✅ Ticket log channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }
};
