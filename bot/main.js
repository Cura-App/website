const Cura = require("cura-app.js");
const client = new Cura();

const userModel = require('../models/user');
const env = process.env;

const fetch = require('node-fetch');

const run = async () => {
    const bot = await userModel.findOne({ id: env.system_bot_id, disabled: false, terminated: false });
    if(!bot){
        console.error('System account was not found!');
        return process.exit(0);
    }

    client.prefix = `/`;
    // client.socketUrl = `ws://localhost:3000`

    client.on("ready", (d) => {
        console.log(`[BOT | READY]`)
        client.socket.on("guild-add", (d) => {
            console.log(d)
        })
    })

    client.on("guild-add", (d) => {
        console.log(d)
    })

    client.command({
        name: `help`,
        run: (msg, args) => {
            return msg.reply(`My prefix is: \`${client.prefix}\`\nI am the official **Cura** system bot!`);
        }
    });

    client.command({
        name: `guild-state`,
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

    client.login(bot.sid);
}

module.exports.run = run;