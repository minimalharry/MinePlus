const { MessageFlags } = require('discord.js');
const embedBuilder = require('../commands/admin/embed_build.js');
const rulesBuilder = require('../commands/admin/rules_panel.js');

const ticketManager = require('../utils/ticketManager');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction) {
    try {

      // =========================
      //   BUTTONS + MODALS
      // =========================

      if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
        const id = interaction.customId || '';

        // 🎫 TICKET BUTTONS
        if (id.startsWith('ticket_') || id === 'notify_toggle' || id === 'notify_user') {
          return ticketManager.handleInteraction(interaction);
        }

        // 📋 RULES BUILDER
        if (id.startsWith('rp_') || id.startsWith('modal_') || id.startsWith('rule_')) {
          return rulesBuilder.handleInteraction(interaction);
        }

        // 🖼️ EMBED BUILDER
        return embedBuilder.handleInteraction(interaction);
      }

      // =========================
      //    SLASH COMMANDS
      // =========================

      if (!interaction.isChatInputCommand()) return;
      if (!interaction.guild) return;

      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      await command.execute(interaction);

    } catch (err) {
      console.error('[InteractionCreate] Error:', err);

      if (interaction.replied || interaction.deferred) {
        interaction.followUp({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral });
      } else {
        interaction.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral });
      }
    }
  }
};
