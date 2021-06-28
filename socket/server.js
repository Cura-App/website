var wait = ms => new Promise((r, j) => setTimeout(r, ms))
const sidGen = require('../utils/sidGen');
const { parser, htmlOutput, toHTML } = require('discord-markdown');
const shortid = require('shortid');
const { v4: uuidv4 } = require('uuid');
const env = process.env;
const fetch = require('node-fetch');
const snow = require('../utils/snowflake');
const bot = require('../bot/main');
const setEmbed = require('../utils/setEmbed');
const { textEmoji } = require('markdown-to-text-emoji'); 

let cache = {};

//? Cooldowns
let cooldowns = {};
cooldowns.newChannel = new Set();
cooldowns.startDM = new Set();
cooldowns.sendMessage = new Set();
cooldowns.validate_account = new Set();
cooldowns.add_bot = new Set();
cooldowns.set_status = new Set();

// ? Models
const userModel = require('../models/user');
const dmModel = require('../models/dm');
const guildModel = require('../models/guild');

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let io = null;


function run(App){

    io = require('socket.io')(App, {
        perMessageDeflate: false,
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });


    io.on("connection", async (socket) => {

        // ? Basic return function
        const fin = (isError, msg) => {
            socket.emit("status", {
                error: isError,
                msg: msg
            });
        }

        // ? Disconnect handler
        socket.on("disconnect", async (e) => {
            let socketId = socket.id;
            delete socket.id;

            const user = await userModel.findOne({
                socket: socketId,
                disabled: false,
                terminated: false
            });

            if(!user) return;

            await userModel.findOneAndUpdate({
                socket: socketId
            }, {
                status: "OFFLINE"
            });

            let rooms = [];

            const dms = await dmModel.find({ 
                users: {
                    $in: user.id
                } 
            });
            const guilds = await guildModel.find({
                users: user.id
            });
            // ? Add guilds here when they are added in
            dms.forEach(x => rooms.push(x.id));
            guilds.forEach(x => rooms.push(x.id));

            return io.in(rooms).emit("user-presence", {
                userId: user.id,
                newStatus: "OFFLINE",
                oldStatus: user.status
            });
        });

        // ? Connect user to dms/guilds
        socket.on("validate-account", async (data) => {
            const sid = data.sid;

            if(!sid) return fin(true, "Action Not Allowed");

            const user = await userModel.findOne({ sid: sid });

            if(!user) return fin(true, "Action Not Allowed.");

            if(user.disabled) return fin(true, "Action Not Allowed.");
            if(user.terminated) return fin(true, "Action Not Allowed.");

            // ? Proceed to connect to rooms (dms/guilds)
            let rooms = [];

            const dms = await dmModel.find({ 
                users: {
                    $in: user.id
                } 
            });
            const guilds = await guildModel.find({
                users: user.id
            });
            // ? Add guilds here when they are added in
            dms.forEach(x => rooms.push(x.id));
            guilds.forEach(x => rooms.push(x.id));

            if(user.bot) rooms.push(`bh:${user.id}`)

            socket.join(rooms);

            user.socket = socket.id;
            await user.save();

            let msg = `Joined rooms: [${rooms}]`
            return fin(false, msg);
        });

        // ? Send message
        socket.on("send-message", async (data) => {
            const dmId = data.id;
            const sid = data.sid;
            const guildId = data.gid;
            let content = data.content;
            let isGuild = false;

            if(!dmId) return fin(true, "Action Not Allowed");
            if(!sid) return fin(true, "Action Not Allowed");
            if(!guildId) return fin(true, "Action Not Allowed");
            if(!content) return fin(true, "Please provide some content for the message!");

            content = content.split("\n");
            let output = [];
          
            content.forEach((value2, index) => {
                if (!(content[index] == "" && content[index+1] == "" && content[index+2] == "")) {
                     output.push(content[index]);
                }
            });
            content = output.join("\n");

            let contentStr = content;
            if(!contentStr) return fin(true, "Please provide some content for the message!");

            const users = await userModel.find({
                disabled: false,
                terminated: false
            })
    
            await setEmbed(data)

            let embed = null;

            if(data.embed) embed = data.embed;

            if(embed){
                if(!embed.description) embed.description = "";
                if(!embed.image) embed.image = "";
                if(!embed.title) embed.title = "-";
                if(!embed.url) embed.url = "-";
            }

            function Mention(node){
                try {
                    return '<a href="/@/' + node.id + `">@` + users.filter(x => x.id === node.id)[0].username + '</a>'
                } catch(e){
                    return '@Unknown'
                }
            }

            content = toHTML(textEmoji(content), {
                discordCallback: {
                    user: node => {
                        return Mention(node)
                    }
                }
            });

            if(!content) return fin(true, "Please provide some content for the message!");

            if(content == "<br>") return fin(true, "Please provide some content for the message!");

            if(content == "<br><br>") return fin(true, "Please provide some content for the message!");

            const user = await userModel.findOne({
                sid: sid
            });
            if(!user) return fin(true, "Action Not Allowed");
            if(user.disabled) return socket.emit("location", {
               href: `/logout` 
            });
            if(user.terminated) return socket.emit("location", {
               href: `/logout` 
            });
            
            const dm = await dmModel.findOne({ 
                id: dmId
            });
            if(!dm) return fin(true, "No channel found.");

            let guild = null;

            let DMQuery = {
                id: dm.id
            }

            let gObj = null;
            let MemberObj = null;

            if(dm.type == 0 || dm.type == 100){
                if(!dm.users.includes(user.id)) return fin(true, "Action Not Allowed");
            } else {
                guild = await guildModel.findOne({ id: guildId, users: user.id, disabled: false });
                if(!guild) return fin(true, "Guild not found.");

                DMQuery = {
                    id: dm.id,
                    guild: guild.id
                }
                isGuild = true;

                gObj = {
                    id: guild.id,
                    name: guild.name
                }

                let roleNum = 0;
                if(guild.mods.includes(user.id)) roleNum = 1;
                if(guild.admins.includes(user.id)) roleNum = 2;
                if(guild.owner == user.id) roleNum = 3;

                MemberObj = {
                    role: roleNum
                }
            }
            
            if (contentStr.length > 256) return fin(true, "Message must be under 256 characters!");

            const msgId = shortid.generate();
            let msg = {
                id: msgId,
                guild: isGuild,
                guildObject: gObj,
                channel: {
                    name: dm.name,
                    id: dm.id
                },
                author: {
                    id: user.id,
                    username: user.username,
                    badges: {
                        mod: user.modBadge,
                        bot: {
                            is: user.bot,
                            verified: user.dev
                        }
                    },
                    data: {
                        role: user.role
                    }
                },
                member: MemberObj,
                content: content,
                embed: embed,
                str: contentStr,
                deleted: false
            }
            
            await wait(100);

            if(!user.bot){
                if (cooldowns.sendMessage.has(sid)) return fin(429, "You're on the fast lane, Slow down there!")
            } else {
                if(user.role < 1){
                    if (cooldowns.sendMessage.has(sid)) return fin(429, "You're on the fast lane, Slow down there!")
                }
            }
            cooldowns.sendMessage.add(sid);
            await dmModel.findOneAndUpdate(DMQuery, {
                $push: {
                    thread: msg
                }
            });

            setTimeout(() => {
                cooldowns.sendMessage.delete(sid);
            }, 500)

            if(guild) io.in(guild.id).emit("new-msg", msg);
            return io.in(dm.id).emit("new-msg", msg);
        });

        socket.on("user-presence", async (data) => {
            let sid = data.sid;
            let status = data.status;

            if(!sid) return fin(true, "Action Not Allowed");
            if(!status) return fin(true, "Action Not Allowed");

            let Allowed = ["ONLINE", "IDLE", "DND", "OFFLINE"];

            if(!Allowed.includes(status)) return fin(true, "Action Not Allowed");

            if(cooldowns.set_status.has(sid)) return fin(true, "Action Not Allowed");

            const user = await userModel.findOne({
                sid: sid,
                disabled: false,
                terminated: false
            });

            if(!user) return fin(true, "Action Not Allowed");

            await userModel.findOneAndUpdate({
                id: user.id,
                sid: sid
            }, {
                status: status
            })

            cooldowns.set_status.add(sid);

            setTimeout(() => {
                cooldowns.set_status.delete(sid);
            }, 100) // .1s

            let rooms = [];

            const dms = await dmModel.find({ 
                users: {
                    $in: user.id
                } 
            });
            const guilds = await guildModel.find({
                users: user.id
            });
            // ? Add guilds here when they are added in
            dms.forEach(x => rooms.push(x.id));
            guilds.forEach(x => rooms.push(x.id));

            setTimeout(async() => {
                await userModel.findOneAndUpdate({
                    id: user.id,
                    sid: sid
                }, {
                    status: "OFFLINE"
                })
                return io.in(rooms).emit("user-presence", {
                    userId: user.id,
                    newStatus: "OFFLINE",
                    oldStatus: status
                });
            }, 15 * 60 * 1000);

            return io.in(rooms).emit("user-presence", {
                userId: user.id,
                newStatus: status,
                oldStatus: user.status
            });
        }); 

        socket.on("message-delete", async (data) => {
            try {
                const dmId = data.dmId;
                const msg = data.msg;
                const sid = data.sid;
                const guildId = data.gid ? data.gid : 'none';

                if(!dmId) return fin(true, "Dm unavailable");
                if(!msg) return fin(true, "Msg unavailable");
                if(!sid) return fin(true, "Action Not Allowed");
                if(!guildId) return fin(true, "Guild unavailable");

                const user = await userModel.findOne({ 
                    sid: sid,
                    terminated: false,
                    disabled: false
                });

                if(!user) return fin(true, "ERR::AUTH");

                let canDelete = false;
                let mid = msg.substring(4);

                let gg = null;

                if(guildId === "none"){
                    return fin(true, "Not supported");
                } else {
                    // for guilds
                    const guild = await guildModel.findOne({
                        id: guildId,
                        disabled: false,
                        users: user.id
                    });
                    if(!guild) return fin(true, "Guild was not found.");

                    gg = guild;

                    const channel = await dmModel.findOne({ 
                        id: dmId, 
                        guild: guild.id
                    });

                    if(!channel) return fin(true, "Channel not found!");


                    let msgObj = channel.thread.filter(x => mid === x.id);
                    msgObj = msgObj[0];

                    if(!msgObj) return fin(true, "Message not found!");
                    if(msgObj.author.id === user.id) canDelete = true;

                    if(guild.mods.includes(user.id)) canDelete = true;
                }

                if(!canDelete) return fin(true, "You can't delete this message!");

                await dmModel.findOneAndUpdate({
                    id: dmId, 
                    guild: gg.id,
                    'thread.id': mid
                }, {
                    $pull: {
                        thread: {
                            id: mid
                        }
                    }
                })

                if(gg) io.in(gg.id).emit("msg-deleted", msg);

                return fin(false, "Message deleted!");
            } catch(e){
                console.log(e)
                return fin(true, "Action not supported");
            }
        });

        // ? Create channel
        socket.on("create-channel", async (data) => {
            const sid = data.sid;
            const gid = data.id;
            const name = data.name;

            if(!sid) return fin(true, "Action Not Allowed"); 
            if(!gid) return fin(true, "Action Not Allowed"); 
            if(!name) return fin(true, "Please insert a name for this channel!");
            if(name.length > 32) return fin(true, "Max character limit is 32!")

            const user = await userModel.findOne({ sid: sid });
            if(!user) return fin(true, "Action Not Allowed"); 

            if(user.disabled) return fin(true, "Action Not Allowed"); 
            if(user.terminated) return fin(true, "Action Not Allowed"); 

            // ? Get guild by owner & id
            const guild = await guildModel.findOne({ 
                id: gid,
                owner: user.id,
                disabled: false
            });
            if(!guild) return fin(true, "This guild is unavailable!");
            
            const guildDms = await dmModel.find({ guild: gid });
            
            await wait(100);

            if (guildDms.length > 30) return fin(true, "You've reached the max number of guild channels!");
            if (cooldowns.newChannel.has(sid)) return fin(429, "You can't create channels this fast!")
            
            cooldowns.newChannel.add(sid);
            const channelId = snow.createSnowFlake();
            const newChannel = new dmModel({
                id: channelId,
                name: name,
                guild: gid,
                type: 1
            });
            await newChannel.save();
            setTimeout(() => {
                cooldowns.newChannel.delete(sid);
            }, 5000)

            setTimeout(() => {
                bot.sendMsg(`Welcome to the start of #${name}!`, gid, channelId);
            }, 1000)

            return socket.emit("location", {
                href: `/g/${gid}/channel/${channelId}`
            });
        });

        // ? Start dm
        socket.on("start-dm", async (data) => {
            const sid = data.sid;
            const fid = data.fid;

            if(!sid) return fin(true, "Action Not Allowed"); 
            if(!fid) return fin(true, "Action Not Allowed"); 

            const user = await userModel.findOne({ sid: sid });
            if(!user) return fin(true, "Action Not Allowed"); 

            if(user.disabled) return fin(true, "Action Not Allowed"); 
            if(user.terminated) return fin(true, "Action Not Allowed"); 
            
            const friend = await userModel.findOne({ id: fid });
            if(!friend) return fin(true, "Could not find user!");
            if(friend.disabled) return fin(true, "This user is unavailable!"); 
            if(friend.terminated) return fin(true, "This user is unavailable!"); 
            
            const userFriends = user.friends;
            const friendFriends = friend.friends;

            if(!userFriends.includes(friend.id)) return fin(true, "You must be friends with this user to start a dm with them!");
            if(!friendFriends.includes(user.id)) return fin(true, "You must be friends with this user to start a dm with them!");

            let existingDms = await dmModel.find();

            existingDms = existingDms.filter(x => x.users.includes(user.id) && x.users.includes(friend.id))[0];

            if(existingDms) return socket.emit("location", {
                href: `/channel/${existingDms.id}`
            });

            await wait(100);

            if (cooldowns.startDM.has(sid)) return fin(429, "You're meeting new people too fast 0_0")
            cooldowns.startDM.add(sid);
            const dmId = snow.createSnowFlake();
            const newDm = new dmModel({
                id: dmId,
                name: `${user.username} & ${friend.username}`,
                users: [
                    user.id,
                    friend.id
                ],
                type: 0
            });
            await newDm.save();
            setTimeout(() => {
                cooldowns.startDM.delete(sid);
            }, 5000)
            return socket.emit("location", {
                href: `/channel/${dmId}`
            });
        });

        // ? Typing events
        socket.on("typing-start", async (data) => {
            const did = data.dmId;
            const gid = data.gId;
            const sid = data.sid;

            if(!did) return fin(true, "Action Not Allowed");
            if(!sid) return fin(true, "Action Not Allowed");

            const user = await userModel.findOne({ sid: sid, disabled: false, terminated: false });
            if(!user) return fin(true, "Action Not Allowed");

            const dm = await dmModel.findOne({ 
                id: did
            });
            if(!dm) return fin(true, "No channel found.");

            let guild = null;

            let sendToRoom = did;

            if(dm.type == 0 || dm.type == 100 || gid == "none"){
                if(!dm.users.includes(user.id)) return fin(true, "Action Not Allowed");
            } else {
                if(!gid) return fin(true, "Action Not Allowed");

                guild = await guildModel.findOne({ id: gid, users: user.id, disabled: false });
                if(!guild) return fin(true, "Guild not found.");

                sendToRoom = gid;
            }
            
            return io.in(sendToRoom).emit("typing-start", {
                username: user.username,
                channel: did
            });
        });

        socket.on("typing-stop", async (data) => {
            const did = data.dmId;
            const gid = data.gId;
            const sid = data.sid;

            if(!did) return fin(true, "Action Not Allowed");
            if(!sid) return fin(true, "Action Not Allowed");

            const user = await userModel.findOne({ sid: sid, disabled: false, terminated: false });
            if(!user) return fin(true, "Action Not Allowed");

            const dm = await dmModel.findOne({ 
                id: did
            });
            if(!dm) return fin(true, "No channel found.");

            let guild = null;

            let sendToRoom = did;

            if(dm.type == 0 || dm.type == 100 || gid == "none"){
                if(!dm.users.includes(user.id)) return fin(true, "Action Not Allowed");
            } else {
                if(!gid) return fin(true, "Action Not Allowed");

                guild = await guildModel.findOne({ id: gid, users: user.id, disabled: false });
                if(!guild) return fin(true, "Guild not found.");

                sendToRoom = gid;
            }
            
            return io.in(sendToRoom).emit("typing-stop", {
                username: user.username
            });
        });

        // ? Guild moderation ban/unban

        socket.on("add-bot", async (data) => {
            const sid = data.sid;
            const appId = data.aid;
            const perm = data.perm;
            const selection = data.g;

            if(!sid) return fin(true,"Action Not Allowed");
            if(!appId) return fin(true,"Invalid app_id!");
            if(!perm) return fin(true,"Invalid permission!");
            if(!selection) return fin(true,"No guild selected!");


            if(cooldowns.add_bot.has(sid)) return fin(true, "You're on the fast lane, Slow down there!")

            cooldowns.add_bot.add(sid);

            setTimeout(() => {
                cooldowns.add_bot.delete(sid);
            }, 500)

            fetch(`${env.SITELINK}/bot/authorize?app_id=${appId}&perm=${perm}&guild=${selection}`, {
                method: "post",
                headers: {
                    "sid": sid
                }
            }).then(r=>r.json())
                .then(async d => {
                    if(d.code !== 200) return fin(true, d.msg)

                    const user = d.json.user;

                    socket.emit("location", {
                        href: `/g/${d.msg}`
                    })
                    
                    let rooms = [];
                    const guilds = await guildModel.find({
                        users: user.id
                    });
                    guilds.forEach(x => rooms.push(x.id));
                    if(user.bot) rooms.push(`bh:${user.id}`)
                    socket.join(rooms);
                    let msg = `Joined rooms: [${rooms}]`
                    fin(false, msg);

                    return io.in(`bh:${d.json.user.id}`).emit("guild-add", d.json)
                });
        });

        socket.on("guild-user-ban", async (data) => {
            const gid = data.gId;
            const sid = data.sid;
            const uid = data.id;

            if(!gid) return fin(true, "Action Not Allowed");
            if(!sid) return fin(true, "Action Not Allowed");
            if(!uid) return fin(true, "Action Not Allowed");

            const user = await userModel.findOne({ 
                sid: sid,
                disabled: false,
                terminated: false
            });

            if(!user) return fin(true, "Action Not Allowed");
            
            const guild = await guildModel.findOne({ 
                id: gid,
                admins: user.id,
                disabled: false
            });
            if(!guild) return fin(true, "Action Not Allowed");

            console.log(uid)
            const target = await userModel.findOne({ id: uid });
            if(!target) return fin(true, "User was not found!");

            if(!guild.users.includes(uid)) return fin(true, "User is not a member of this guild!");

            if(uid == user.id) return fin(true, "You can't ban yourself!");
            if(guild.owner == uid) return fin(true, "You can't ban the owner!");

            if(target.id == env.system_bot_id) return fin(true, "You can't ban the system account!");

            async function ban(){
                await guildModel.findOneAndUpdate({
                    id: guild.id
                }, {
                    $pull: {
                        users: target.id,
                        admin: target.id,
                        mods: target.id
                    },
                    $push: {
                        logs: {
                            title: `User banned`,
                            content: `${target.username} was been banned.`,
                            by: user.username
                        },
                        banned: target.id
                    }
                });

                return fin(false, "User has been banned!");
            }

            if(guild.owner == user.id) return ban();
            if(!guild.admins.includes(target.id)) return ban();
        });
    });
}



module.exports.io = io;
module.exports.run = run