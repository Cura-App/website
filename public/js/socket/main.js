const socket = io.connect(getWSConn(), { transforms: [] });
const usid = getUserSID();
const uid = getUserId();
const usern = getUserName();
const userRole = getUserRole ? getUserRole : 0;
let typing = [];
let typingUsers = {};
let statusCache = [];

// Audio
function play_notification_sound() {
    // ? Sound is taken from
    // https://notificationsounds.com/standard-ringtones/oringz-w438-316 ( Creative Commons )
    var audio = new Audio('/media/root/sounds/notification.ogg');
    audio.play();
}

function userPresence(STATUS){
    socket.emit("user-presence", {
        sid: usid,
        status: STATUS
    }); 
}

(() => {
    socket.emit("validate-account", {
        sid: usid
    });

    setTimeout(() => {
        userPresence("ONLINE")
    },100)
})()

window.addEventListener("beforeunload", () => {
    userPresence("OFFLINE")
})

socket.on("user-presence", (data) => {
    console.log(data)
    statusCache[data.userId] = {
        status: data.newStatus.toLowerCase()
    };
})

socket.on("status", (data) => {
    console.log(data);

    if(data.error) return Toast.fire({
        icon: "error",
        text: data.msg
    })
})

socket.on("s-status", (data) => {
    console.log(data);

    return Toast.fire({
        icon: "success",
        text: data.msg
    })
})

socket.on("location", (d) => {
    window.location.href = d.href;
    // console.error("[LOCATION] DISABLED")
});

Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};


socket.on("typing-start", (d) => {
    if (typing.includes(escapeHtml(d.username))) return;
    if (d.username === usern) return;
    const channel = d.channel;

    console.log(channel, getThreadId)

    if(channel !== getThreadId) return;

    typing.push(d.username);
    typingUsers[escapeHtml(d.username)] = 5;
    refreshTypingText();
})

socket.on("typing-stop", (d) => {
    if (!typing.includes(escapeHtml(d.username))) return;
    if (d.username === usern) return;
    typing.remove(escapeHtml(d.username))
    refreshTypingText();
})

setInterval(() => {
    Object.keys(typingUsers).forEach((k, i) => {
        typingUsers[k] = typingUsers[k] - 1;
        if (typingUsers[k] < 1) {
            typing.remove(k)
            refreshTypingText();
        } 
    })
}, 1000);

const startDM = (fid) => {
    socket.emit("start-dm", {
        sid: usid,
        fid: fid
    });
}


// ? Message handler
const messageArea = (dmId, guildId) => {
    socket.emit("typing-start", {
        dmId: dmId,
        gId: guildId,
        sid: usid
    })
    var key = window.event.keyCode;
    if(key == 13) {
        const text = document.getElementById("messageText");
        const val = text.value

        socket.emit("send-message", {
            id: dmId,
            sid: usid,
            gid: guildId,
            content: val
        });

        setTimeout(() => {
            stopTyping(dmId, guildId);
        }, 100)

        text.value = '';
    }
}

const refreshTypingText = () => {
    try {
        let typingElm = document.getElementById("typing");
        if (typing.length < 1) {
            typingElm.style.visibility = "hidden"
        } else {
            if (typing.length < 2) {
                typingElm.innerHTML = "<b>" + typing.join(", ") + "</b> is typing..."
            } else if (typing.length > 3) {
                typingElm.innerHTML = "<b>Multiple Users</b> are typing..."
            } else {
                typingElm.innerHTML = "<b>" + typing.join(", ") + "</b> are typing..."
            }
            typingElm.style.visibility = "visible"
        }
    } catch(e){
        return;
    }
}
const stopTyping = (dmId, guildId) => {
    socket.emit("typing-stop", {
        sid: usid,
        dmId: dmId,
        gId: guildId
    })
}

socket.on("new-msg", (data) => {
    const username = escapeHtml(data.author.username);
    const channelName = escapeHtml(data.channel.name);

    console.log(data)
    try {
        if(data.channel.id !== getThreadId){
            if(data.author.id == uid) return;

            if(!data.guild){
                play_notification_sound()
                return notification(`New message from: ${username}`, `/channel/${data.channel.id}`);
            } else {
                play_notification_sound()
                return notification(`New message in: ${channelName}`, `/channel/${data.channel.id}`);
            }
        }

        // let userStatus = statusCache[data.author.id].status;

        const content = data.content;
        const thread = document.getElementById("thread");

        const template = () => {
            let bot_badge = ``;

            if(data.author.badges.bot.is){
                bot_badge = `
                    <span class="badge badge-primary purple">
                        Bot
                    </span>
                `
                if(data.author.badges.bot.verified) bot_badge = `
                    <span class="badge badge-primary">
                        <img src="/media/svg/check-circle.svg" height="10" data-toggle="tooltip" title="Verified Bot"> Bot
                    </span>
                `
            }

            let staffBadge = '';
            if(data.guild){
                try {
                    staffBadge = guild_GetStaffBadge(`${data.member.role}`, `return`);
                } catch(e){
                    console.log(e)
                }
            }

            let delBtn = ``;

            if(data.guild){

                if(userRole > 0) delBtn = `<button class="btn btn-danger btn-sm ml-2" onclick="deleteMessage('msg-<%= x.id %>', '<%= dm.id %>', '<%= guild.id %>')">Delete</button>`
                if(data.author.id === uid) delBtn = `<button class="btn btn-danger btn-sm ml-2" onclick="deleteMessage('msg-<%= x.id %>', '<%= dm.id %>', '<%= guild.id %>')">Delete</button>`

            }

            let embedMsg = ``;

            if(data.embed) embedMsg = `
                <blockquote class="embed">
                    <div class="img-holder">
                        <img class="image" src="${data.embed.image}" onerror="_imgError(this)">
                    </div>
                    <h4 class="title">
                        &nbsp;${data.embed.title}
                    </h4>
                    <br>
                    <p class="meta">
                        ${data.embed.description}
                    </p>
                </blockquote>
            `;

            return `
            <div class="instance" id="msg-${data.id}">
                <span class="company-text">
                    <a  href="javascript:void(0)" onclick="showUserMenu('${data.author.id}', '${username}')">${username}</a> ${bot_badge}
                    <span id="usb-${data.id}">${staffBadge}</span>
                    ${delBtn}
                    <br>${content}
                    ${embedMsg}
                </span>
            </div>
            `
        }

        thread.innerHTML = thread.innerHTML + template();
        $(`#thread`).scrollTop($(`#thread`)[0].scrollHeight)
    } catch(e){
        console.error(e)
        if(data.author.id == uid) return;
        if(!data.guild){
            play_notification_sound()
            return notification(`New message from: ${username}`, `/channel/${data.channel.id}`);
        } else {
            play_notification_sound()
            return notification(`New message in: ${channelName}`, `/channel/${data.channel.id}`);
        }
    }
});

socket.on("msg-deleted", (d) => {
    console.log(d)
    document.getElementById(d).remove()
});

const banUser = (id, gid) => {
    socket.emit("guild-user-ban", {
        gId: gid,
        sid: getUserSID(),
        id: id
    });
}

const deleteMessage = (msgid, dmId, guildId) => {
    socket.emit("message-delete", {
        sid: usid,
        msg: msgid,
        dmId: dmId,
        gid: guildId
    })
}