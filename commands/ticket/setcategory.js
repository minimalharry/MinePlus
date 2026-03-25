const { ChannelType, MessageFlags } = require('discord.js');

module.exports = {
  name: 'setcategory',
  description: 'Set Discord category where ticket channels are created',
  options: [
    {
      name: 'category',
      description: 'Category channel',
      type: 'channel',
      required: true
    }
  ],
  async execute(interaction, manager) {
    if (!interaction.memberPermissions?.has('ManageGuild') && !interaction.memberPermissions?.has('ManageChannels')) {
      return interaction.reply({ content: 'You need Manage Server or Manage Channels permission.', flags: MessageFlags.Ephemeral });
    }

    const category = interaction.options.getChannel('category', true);
    if (category.type !== ChannelType.GuildCategory) {
      return interaction.reply({ content: 'Please provide a category channel.', flags: MessageFlags.Ephemeral });
    }

    const ticketSystem = await manager.getTicketSystem(interaction.guildId);
    ticketSystem.settings.ticketsCategoryId = category.id;
    await manager.saveTicketSystem(interaction.guildId, ticketSystem);

    return interaction.reply({ content: `✅ Ticket create category set to **${category.name}**.`, flags: MessageFlags.Ephemeral });
  }
};
