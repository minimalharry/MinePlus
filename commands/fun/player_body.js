const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
  
const config = require('../../resources/config.json');
const { getTranslation } = require('../../languages/controller');
const lang = getTranslation();

module.exports = 
{
    // -------------------
    //    SLASH BUILDER
    // -------------------  
    
    data: new SlashCommandBuilder()
        .setName(lang.playerBody.slash.name)
        .setDescription(lang.playerBody.slash.description)
        
        .addStringOption(option => option.setName(lang.playerBody.slash.option.name)
            .setDescription(lang.playerBody.slash.option.description)
            .setRequired(true)
        ),
  
    // -------------------
    //   COMMAND EXECUTE
    // -------------------

    async execute(interaction) 
    {
        let uuid;
        const mention = interaction.user.toString();
        const username = interaction.options.getString(lang.playerBody.slash.option.name);

        // -------------------
        //    COMMAND CHECK
        // -------------------

        if(!config.commands.player_body) 
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
        //    GET USER UUID
        // -------------------
        
        try 
        {
            const response = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            uuid = response.data.id;
        }

        // -------------------
        //   USER NOT FOUND
        // -------------------        
        
        catch (error) 
        {
            const headNotFoundEmbed = new EmbedBuilder()
                .setTitle(lang.playerBody.embed.notfound.title)
                .setDescription(lang.playerBody.embed.notfound.description.replace('{player_name}', username))
                .setColor("Red")
                .setTimestamp();
                
            return interaction.reply({
                content: mention,
                embeds: [headNotFoundEmbed],
                flags: 64
            });
        }

        // -------------------
        //     USER FOUND
        // -------------------        

        try 
        {
            const sucessEmbed = new EmbedBuilder()
                .setTitle(lang.playerBody.embed.showbody.title.replace('{player_name}', username))
                .setColor("Yellow")
                .setTimestamp()
                .setImage(`https://crafatar.com/renders/body/${uuid}.png`);
                
            return interaction.reply({
                content: mention,
                embeds: [sucessEmbed],});
        }

        // -------------------
        //    INTERNAL ERROR
        // -------------------        
        
        catch(error)
        {
            // -------------------
            //   ERROR FEEDBACK
            // -------------------
        
            console.log(error);
            console.log("[MinePlus] => [C] Critical => An unknown error occurred in the Player Skin command!");
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