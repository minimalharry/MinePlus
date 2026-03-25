const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'setup',
  description: 'Open advanced ticket panel setup builder',
  options: [
    {
      name: 'channel',
      description: 'Channel where the final ticket panel will be sent',
      type: 'channel',
      required: false
    }
  ],
  async execute(interaction, manager) {
    if (!interaction.memberPermissions?.has('ManageGuild') && !interaction.memberPermissions?.has('ManageChannels')) {
      return interaction.reply({
        content: 'You need `Manage Server` or `Manage Channels` permission to run ticket setup.',
        flags: MessageFlags.Ephemeral
      });
    }

    const selectedChannel = interaction.options.getChannel('channel') || interaction.channel;
    return manager.startSetup(interaction, selectedChannel);
  }
};
