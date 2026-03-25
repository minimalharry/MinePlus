const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const manager = require('../../utils/ticketManager');

const setup = require('./setup');
const add = require('./add');
const remove = require('./remove');
const close = require('./close');
const claim = require('./claim');
const rename = require('./rename');
const setlog = require('./setlog');
const setcategory = require('./setcategory');
const setautoclose = require('./setautoclose');

const subcommands = [setup, add, remove, close, claim, rename, setlog, setcategory, setautoclose];

function applyOptions(builder, command) {
  if (!command.options) return builder;

  for (const option of command.options) {
    if (option.type === 'user') {
      builder.addUserOption(opt =>
        opt.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required))
      );
      continue;
    }

    if (option.type === 'string') {
      builder.addStringOption(opt =>
        opt.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required))
      );
      continue;
    }

    if (option.type === 'channel') {
      builder.addChannelOption(opt =>
        opt.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required))
      );
      continue;
    }

    if (option.type === 'integer') {
      builder.addIntegerOption(opt =>
        opt.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required))
      );
    }
  }

  return builder;
}

const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Advanced ticket system');

for (const sub of subcommands) {
  data.addSubcommand(subBuilder => {
    subBuilder.setName(sub.name).setDescription(sub.description);
    return applyOptions(subBuilder, sub);
  });
}

module.exports = {
  data,

  async execute(interaction) {
    const name = interaction.options.getSubcommand();
    const handler = subcommands.find(cmd => cmd.name === name);

    if (!handler) {
      return interaction.reply({
        content: 'Unknown ticket subcommand.',
        flags: MessageFlags.Ephemeral
      });
    }

    return handler.execute(interaction, manager);
  }
};
