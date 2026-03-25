module.exports = {
  name: 'remove',
  description: 'Remove a user from the current ticket channel',
  options: [
    {
      name: 'user',
      description: 'User to remove',
      type: 'user',
      required: true
    }
  ],
  async execute(interaction, manager) {
    const user = interaction.options.getUser('user', true);
    return manager.removeUserFromTicket(interaction, user.id);
  }
};
