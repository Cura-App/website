const Cura = require("cura-app.js");
const client = new Cura();

const userModel = require('../models/user');
const premiumModel = require('../models/premium');
const base64 = require('../utils/base64');
const env = process.env;

const fetch = require('node-fetch');
const shortId = require('shortid');

const run = async () => {
    try {
        const bot = await userModel.findOne({ id: env.system_bot_id, disabled: false, terminated: false });
        if(!bot) return console.error('System account was not found!');

        client.prefix = `/`;
        client.socketUrl = `ws://localhost:3000`

        client.on("ready", (d) => {
            console.log(`[BOT | READY]`)
            client.socket.on("guild-add", (d) => {
                console.log(d)
            })
        })

        client.command({
            name: `help`,
            description: `You are currently viewing this!`,
            show: true,
            run: (msg, args) => {
                let helpMessage = `**HELP MENU**`;
                client.cmdHandlerInt.forEach((cmd, i) => {
                    if(cmd.show){
                        helpMessage += `\n\`${cmd.name}\` - *${cmd.description}*`
                    }
                })
                msg.reply(helpMessage)
            }
        });

        client.command({
            name: `guild-state`,
            show: false,
            run: (msg, args) => {
                if(msg.author.data.role < 998) return msg.reply(`Action Not Allowed.`);
                
                const id = args[0];
                const state = args[1];

                if(!id) return msg.reply(`Command example: \`/\`guild-state *guildId* *disable/enable*`);

                fetch(env.SITELINK + `/g/${id}/status/${state}`, {
                    method: "post",
                    headers: {
                        "sid": bot.sid
                    }
                }).then(r=>r.json())
                    .then(d => {
                        return msg.reply(`\`Finished\`\n[${d.code}] => *${d.msg}*`)
                    })
            }
        });

        client.command({
            name: `premium-code`,
            show: false,
            run: async (msg, args) => {
                if(msg.author.data.role < 998) return msg.reply(`Action Not Allowed.`);
                
                const isByBot = args[0];

                if(!isByBot) return msg.reply(`Command example: \`/\`premium-code *isByBot (Bool)*`);

                const gid = shortId.generate();
                const code = base64(30);

                let author = msg.author.username;
                if(isByBot) author = bot.username;

                const prem = new premiumModel({
                    id: gid,
                    code: code,
                    from: author
                });
                await prem.save();

                return msg.reply(`> **Gift Code Created!**: \`${code}\`\n${env.SITELINK}/gift/${code}`)
            }
        });

        client.command({
            name: `announce`,
            description: `Announce a message in this channel.`,
            show: true,
            run: (msg, args) => {
                if(msg.member.role < 1) return msg.reply("You must be a `moderator` to do this!");
            
                if(!args[0]) return msg.reply("Please provide me a message to send as announcement!");

                return msg.reply(`> **⚠️ Announcement**\n${args.join(" ")}\n\nBy: <@${msg.author.id}>`)
            }
        })

        client.login(bot.sid);
    } catch(e){
        console.log(e);
    }


    module.exports.sendMsg = (content, guildId, dm) => {
        client.send(content, guildId, dm);
    }
}

module.exports.run = run;