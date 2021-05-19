var wait = ms => new Promise((r, j) => setTimeout(r, ms))
const sidGen = require('../utils/sidGen');
const { parser, htmlOutput, toHTML } = require('discord-markdown');
const shortid = require('shortid');
const { v4: uuidv4 } = require('uuid');
const env = process.env;

//? Cooldowns
let cooldowns = {};
cooldowns.newChannel = new Set();
cooldowns.startDM = new Set();
cooldowns.sendMessage = new Set();

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

function run(App){

    const io = require('socket.io')(App, {
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
        const success = (msg) => {
            socket.emit("s-status", {
                msg: msg
            });
        }

        // ? Disconnect handler
        socket.on("disconnect", (e) => {
            delete socket.id;
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

            socket.join(rooms);

            return fin(false, `Joined rooms: [${rooms}]`);
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

            content = toHTML(content);

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
            }
            
            if (contentStr.length > 256) return fin(true, "Message must be under 256 characters!");

            const msgId = shortid.generate();
            let msg = {
                id: msgId,
                guild: isGuild,
                channel: {
                    name: dm.name,
                    id: dm.id
                },
                author: {
                    id: user.id,
                    username: user.username,
                    badges: {
                        mod: user.modBadge
                    }
                },
                content: content,
                str: contentStr
            }
            
            await wait(100);

            if (cooldowns.sendMessage.has(sid)) return fin(429, "You're on the fast lane, Slow down there!")
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
            const channelId = uuidv4();
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
            const dmId = uuidv4();
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
                username: user.username
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
    });
}

module.exports.run = run