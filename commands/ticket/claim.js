module.exports = {
  name: 'claim',
  description: 'Claim the current ticket (staff only)',
  async execute(interaction, manager) {
    return manager.claimTicket(interaction);
  }
};
