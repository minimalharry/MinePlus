const { EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const config = require('../../resources/config.json');
const { getTranslation } = require('../../languages/controller');
const lang = getTranslation();

module.exports = 
{
    // -------------------
    //    SLASH BUILDER
    // -------------------

    data: new SlashCommandBuilder()
        .setName(lang.ip.slash.name)
        .setDescription(lang.ip.slash.description),

    // -------------------
    //   COMMAND BUILDER
    // -------------------

    async execute(interaction) 
    {
        const ip = config.about.server_adress;
        const name = config.about.server_name;
        const port = config.about.server_port;

        const user = interaction.user.username;
        const mention = interaction.user.toString();

        // -------------------
        //    COMMAND CHECK
        // -------------------

        if(!config.commands.ip)
        {
            const unavailableCommand = new EmbedBuilder()
                .setTitle(lang.universal.embeds.unavailable.title)
                .setColor("Red")
                .setDescription(lang.universal.embeds.unavailable.description)
                .setTimestamp();

            return interaction.reply({
                content: mention,
                embeds: [unavailableCommand],
                flags: 64
            });
        }

        // -------------------
        //    EMBED BUILDER
        // -------------------

        const ipEmbed = new EmbedBuilder()
            .setTitle(lang.ip.embed.title)

            .setDescription(lang.ip.embed.description
                .replace('{server_ip}', ip)
                .replace('{user_name}', user)
                .replace('{server_port}', port)
                .replace('{server_name}', name)
            )

            .setColor("Blue")
            .setTimestamp();

        // -------------------
        //     SEND EMBED
        // -------------------

        try 
        {
            return interaction.reply({
                content: mention,
                embeds: [ipEmbed],});
        }

        catch(error)
        {
            // -------------------
            //   ERROR FEEDBACK
            // -------------------
        
            console.log(error);
            console.log("[MinePlus] => [C] Critical => An unknown error occurred in the IP command!");
            console.log("[MinesPlus] => [L] Log => Send the log to: https://github.com/Henry8K/Minescord");
        
            // -------------------
            //     ERROR EMBED
            // -------------------            
        
            const errorEmbed = new EmbedBuilder()
                .setTitle(lang.universal.embeds.broken.title)
                .setDescription(lang.universal.embeds.broken.description)
                .setColor("Green")
                .setTimestamp();

            // -------------------
            //     ERROR SEND
            // -------------------
                
            return interaction.reply({
                content: mention,
                embeds: [errorEmbed],
                flags: 64
            });
        }
    }
};