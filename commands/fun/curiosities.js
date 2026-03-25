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
        .setName(lang.curiosities.slash.name)
        .setDescription(lang.curiosities.slash.description),

    // -------------------
    //   COMMAND BUILDER
    // -------------------

    async execute(interaction) 
    {
        const mention = interaction.user.toString();

        // -------------------
        //    COMMAND CHECK
        // -------------------

        if(!config.commands.curiosities) 
        {
            const unavailableCommand = new EmbedBuilder()
                .setTitle(lang.universal.embeds.unavailable.title)
                .setDescription(lang.universal.embeds.unavailable.description)
                .setColor("Red")
                .setTimestamp();
            
            return interaction.reply({
                content: mention,
                embeds: [unavailableCommand],
                flags: 64
            });
        } 
        
        // -------------------
        //     CURIOSITIES
        // -------------------

        const curiosities = Object.values(lang.curiosities.array);

        const randomIndex = Math.floor(Math.random() * curiosities.length);
        const curiosity = curiosities[randomIndex];
        
        // -------------------
        //    EMBED BUILDER
        // -------------------
        
        const curiositiesEmbed = new EmbedBuilder()
            .setTitle(lang.curiosities.embed.title)
            .setDescription(lang.curiosities.embed.description.replace('{curiosity}', curiosity))
            .setColor("Blue")
            .setTimestamp();

        // -------------------
        //     SEND EMBED
        // -------------------

        try
        {
            return interaction.reply({
                content: mention,
                embeds: [curiositiesEmbed],});            
        }

        catch(error)
        {
            // -------------------
            //   ERROR FEEDBACK
            // -------------------
        
            console.log(error);
            console.log("[MinePlus] => [C] Critical => An unknown error occurred in the Curiosities command!");
            console.log("[MinePlus] => [L] Log => Send the log to: https://github.com/minimalharry");
        
            // -------------------
            //     ERROR EMBED
            // -------------------            
        
            const errorEmbed = new EmbedBuilder()
                .setTitle(lang.universal.embeds.broken.title)
                .setDescription(lang.universal.embeds.broken.description)
                .setColor("DarkRed")
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