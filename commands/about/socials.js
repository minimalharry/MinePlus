const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder} = require('discord.js');
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
        .setName(lang.socials.slash.name)
        .setDescription(lang.socials.slash.description),

    // -------------------
    //   COMMAND EXECUTE
    // -------------------

    async execute(interaction)
    {
        const row = new ActionRowBuilder();
        const mention = interaction.user.toString();
        const socialsPlatforms = ['youtube', 'instagram'];

        const socials = config.socials;
        const allInactive = !Object.values(socials).some(social => social.active);

        // -------------------
        //    COMMAND CHECK
        // -------------------

        if(!config.commands.socials) 
        {
            const unavailableCommand = new EmbedBuilder()
                .setTitle(lang.universal.embeds.unavailable.title)
                .setColor("Green")
                .setDescription(lang.universal.embeds.unavailable.description)
                .setTimestamp();
            
            return interaction.reply({
                content: mention,
                embeds: [unavailableCommand],
                flags: 64
            });
        }

        // -------------------
        //    SOCIALS CHECK
        // -------------------
        
        if(allInactive) 
        {
            const inactiveEmbed = new EmbedBuilder()
                .setTimestamp()
                .setTitle(lang.socials.embed.inactive.title)
                .setDescription(lang.socials.embed.inactive.description)
                .setColor("Green");

            return interaction.reply({
                content: mention,
                embeds: [inactiveEmbed],
                flags: 64
            });
        }
        
        // -------------------
        //    SOCIAL EMBED
        // -------------------
        
        const socialEmbed = new EmbedBuilder()
            .setTitle(lang.socials.embed.social.title)
            .setDescription(lang.socials.embed.social.description)
            .setColor("Green")
            .setImage("https://blog.connectedcamps.com/wp-content/uploads/2017/01/novaskin-minecraft-wallpaper-2.jpeg")
            .setTimestamp();

        // -------------------
        //   SOCIALS BUTTONS
        // -------------------

        for(const platform of socialsPlatforms) 
        {
            if(config.socials[platform].active)
            {
                const socialsButton = new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.socials[platform].link)
                    .setEmoji(config.socials[platform].emoji)
                    .setLabel(platform.charAt(0).toUpperCase() + platform.slice(1));

                row.addComponents(socialsButton);
            }
        }
    
        const modules = [row];

        // -------------------
        //     SEND SOCIALS
        // -------------------

        try 
        {    
            return interaction.reply({
                content: mention,
                embeds: [socialEmbed],
                components: modules,});
        }

        catch(error)
        {
            // -------------------
            //   ERROR FEEDBACK
            // -------------------
        
            console.log(error);
            console.log("[MinesPlus] => [C] Critical => An unknown error occurred in the IP command!");
            console.log("[MinesPlus] => [L] Log => Send the log to: https://github.com/minimalharry");
        
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