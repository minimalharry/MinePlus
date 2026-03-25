module.exports = {
  name: 'rename',
  description: 'Rename the current ticket channel',
  options: [
    {
      name: 'name',
      description: 'New ticket channel name',
      type: 'string',
      required: true
    }
  ],
  async execute(interaction, manager) {
    const name = interaction.options.getString('name', true);
    return manager.renameTicket(interaction, name);
  }
};
