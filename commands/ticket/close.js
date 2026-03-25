module.exports = {
  name: 'close',
  description: 'Close the current ticket with optional reason',
  options: [
    {
      name: 'reason',
      description: 'Reason for closing the ticket',
      type: 'string',
      required: false
    }
  ],
  async execute(interaction, manager) {
    const reason = interaction.options.getString('reason') || 'No reason';
    return manager.requestClose(interaction, reason);
  }
};
