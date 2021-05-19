const socket = io.connect(getWSConn(), { transforms: [] });
const usid = getUserSID();
const uid = getUserId();
const usern = getUserName();
let typing = [];
let typingUsers = {};

// Audio
function play_notification_sound() {
    // ? Sound is taken from
    // https://notificationsounds.com/standard-ringtones/oringz-w438-316 ( Creative Commons )
    var audio = new Audio('/media/root/sounds/notification.ogg');
    audio.play();
}

(() => {
    socket.emit("validate-account", {
        sid: usid
    })
})()

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

        const content = data.content;
        const thread = document.getElementById("thread");

        const template = () => {
            return `
            <div class="instance">
                <span class="company-text">
                    <a href="/@/${data.author.id}">${username}</a>: ${content}
                </span>
            </div>
            `
        }

        thread.innerHTML = thread.innerHTML + template();
        $(`#thread`).scrollTop($(`#thread`)[0].scrollHeight)
    } catch(e){
        if(data.author.id == uid) return;
        if(!data.guild){
            play_notification_sound()
            return notification(`New message from: ${username}`, `/channel/${data.channel.id}`);
        } else {
            play_notification_sound()
            return notification(`New message in: ${channelName}`, `/channel/${data.channel.id}`);
        }
    }
})