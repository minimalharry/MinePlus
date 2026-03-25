const fs = require('fs');
const managePresence = require('./events/status');
const { token } = require('./config.json');

const { Client, Collection, MessageFlags } = require('discord.js');

const client = new Client({
    intents: [1, 2, 128, 512, 32768]
});

// 🔥 SYSTEMS
const embedBuilder = require('./commands/admin/embed_build.js');
const rulesBuilder = require('./commands/admin/rules_panel.js');
const ticketManager = require('./utils/ticketManager');

// -------------------
//    CMD REGISTER
// -------------------

client.commands = new Collection();
const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
    const folderFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));

    for (const file of folderFiles) {
        const command = require(`./commands/${folder}/${file}`);

        if (command.data && command.data.name) {
            client.commands.set(command.data.name, command);
        }
    }
}

// -------------------
//      BOT LOAD
// -------------------

client.once('clientReady', async () => {

    const commandData = client.commands.map(command => command.data.toJSON());
    await client.application.commands.set(commandData);

    console.log(`[MinePlus] => [v] Success => Logged in as ${client.user.tag}!`);
    console.log(`[MinePlus] => [!] Alert => ${commandData.length} registered commands.`);
    console.log(`[MinePlus] => [L] Log => https://github.com/minimalharry/MinePlus`);

    managePresence(client);
    ticketManager.startInactivityWatcher(client);
});

// -------------------
//    INTERACTIONS
// -------------------

client.on('interactionCreate', async interaction => {

    try {

        // =========================
        // 🔥 BUTTONS + MODALS FIXED ROUTING
        // =========================
        if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {

            const id = interaction.customId || '';

            // 🎫 TICKET BUTTONS
            if (id.startsWith('ticket_') || id === 'notify_toggle' || id === 'notify_user') {
                return ticketManager.handleInteraction(interaction);
            }

            // 👉 RULES BUILDER
            if (id.startsWith('rp_') || id.startsWith('modal_') || id.startsWith('rule_')) {
                return rulesBuilder.handleInteraction(interaction);
            }

            // 👉 EMBED BUILDER
            return embedBuilder.handleInteraction(interaction);
        }

        // =========================
        // 🔹 SLASH COMMANDS
        // =========================
        if (!interaction.isChatInputCommand()) return;
        if (!interaction.guild) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction);

    } catch (err) {
        console.error('Interaction Error:', err);

        if (interaction.replied || interaction.deferred) {
            interaction.followUp({ content: '❌ Something went wrong', flags: MessageFlags.Ephemeral });
        } else {
            interaction.reply({ content: '❌ Something went wrong', flags: MessageFlags.Ephemeral });
        }
    }
});

// -------------------
//      EVENTS
// -------------------

require('./events/rules_panel')(client);
require('./events/greet')(client);
require('./events/autoresponder')(client);
require('./events/ticketActivity')(client);

// -------------------

client.login(token);
