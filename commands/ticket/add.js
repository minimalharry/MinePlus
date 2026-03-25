module.exports = {
  name: 'add',
  description: 'Add a user to the current ticket channel',
  options: [
    {
      name: 'user',
      description: 'User to add',
      type: 'user',
      required: true
    }
  ],
  async execute(interaction, manager) {
    const user = interaction.options.getUser('user', true);
    return manager.addUserToTicket(interaction, user.id);
  }
};
