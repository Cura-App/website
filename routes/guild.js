const express = require('express');
const router = express.Router();


// ? Models 
const userModel = require('../models/user');
const guildModel = require('../models/guild');
const dmModel = require('../models/dm');

// ? Packages
const rateLimit = require("express-rate-limit");
const formidable = require('formidable');
const shortid = require('shortid');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const mv = require('mv');
const env = process.env;
const renderUserObjects = require('../utils/renderUserObjects');

const newGuildRateLimit = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 3,
    redirect: '/@me?e=g-ratelimit',
    handler: function (req, res) {
        return res.redirect('/@me?e=g-ratelimit');
    }
});

const newInviteRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    redirect: '/@me?e=i-ratelimit',
    handler: function (req, res) {
        return res.redirect('/@me?e=i-ratelimit');
    }
});

router.post("/api/new", newGuildRateLimit, async (req, res) => {
    const sid = req.header("sid");
    const name = req.body.name;

    const f = (code, msg) => {
        return res.status(code).send({
            code, 
            msg
        })
    }

    if(!sid) return f(400, "Action Not Allowed");
    if(!name) return f(400, "Please submit a guild name!");
    
    if(name.length > 30) return f(401, "Max name length is 30 characters!");

    const user = await userModel.findOne({ 
        sid: sid
    });
    if(!user) return f(401, "Action Not Allowed");
    if(user.disabled) return f(401, "Action Not Allowed");
    if(user.terminated) return f(401, "Action Not Allowed")

    const guilds = await guildModel.find({ owner: user.id });

    if(guilds.length >= env.maxGuilds) return f(401, `You cannot make more then ${env.maxGuilds} guilds!`);

    const id = require('../utils/snowflake').createSnowFlake();

    const newGuild = new guildModel({
        id: id,
        name: name,
        users: [user.id, env.system_bot_id],
        admins: [user.id, env.system_bot_id],
        mods: [user.id, env.system_bot_id],
        owner: user.id
    });
    await newGuild.save();

    return f(200, id);
});

router.post("/api/new-invite", newInviteRateLimit, async (req, res) => {
    const sid = req.header("sid");
    const guildid = req.query.id;

    const f = (code, msg) => {
        return res.status(code).send({
            code, 
            msg
        })
    }

    if(!sid) return f(400, "Action Not Allowed");
    if(!guildid) return f(400, "Action Not Allowed");

    const user = await userModel.findOne({ sid: sid, disabled: false, terminated: false });
    if(!user) return f(401, "Action Not Allowed");

    // ? Add actual perms someday
    const guild = await guildModel.findOne({ id: guildid, owner: user.id, disabled: false });
    if(!guild) return f(401, "Action Not Allowed");

    const invite = shortid.generate();
    await guildModel.findOneAndUpdate({
        id: guildid,
        owner: user.id,
        disabled: false
    }, {
        $push: {
            invites: invite
        }
    });

    return f(200, guildid);
});

router.get("/:id/channel/:cid", checkAuth, async (req, res) => {
    const id = req.params.id;
    const cid = req.params.cid;

    const e = (msg) => {
        return res.render('errors/error.ejs', { pageName: "Error", msg, user: req.user });
    }
    if(!id) return e("Invalid id passed!");
    if(!cid) return e("Invalid cid passed!");

    const guild = await guildModel.findOne({ id: id, users: req.user.id });
    if(!guild) return e("You must be in this guild to view this page.");
    if(guild.disabled) return e("This guild has been disabled.");

    const dm = await dmModel.findOne({ id: cid, type: 1 });
    if(!dm) return e("Channel could not be found!");

    const guilds = await guildModel.find({ users: req.user.id }); 

    const userObjects = await renderUserObjects();

    let data = {
        pageName: `${guild.name} / ${dm.name}`,
        user: req.user,
        dm,
        guild,
        guilds: guilds.reverse(),
        users: userObjects
    }

    return res.render('app/guild/channel.ejs', data);
});

router.post('/:id/status/:state', async (req, res) => {
    const id = req.params.id;
    const state = req.params.state;
    const sid = req.header("sid");

    const f = (code, msg) => {
        return res.status(code).send({
            code, 
            msg
        })
    }

    if(!id) return f(400, "Action Not Allowed");
    if(!state) return f(400, "Action Not Allowed");
    if(!sid) return f(400, "Action Not Allowed");

    const user = await userModel.findOne({ sid: sid, disabled: false, terminated: false });
    if(!user) return f(400, "Action Not Allowed");

    if(user.role < 998) return f(401, "Action Not Allowed");

    const guild = await guildModel.findOne({ 
        id: id
    })

    if(state == "disable"){
        await guildModel.findOneAndUpdate({
            id: id
        }, {
            disabled: true,
            $push: {
                logs: {
                    title: `Guild disabled`,
                    content: `This guild has been disabled by Team Cura.`,
                    by: user.username
                }
            }
        })
        return f(200, "Guild disabled.");
    } else {
        await guildModel.findOneAndUpdate({
            id: id
        }, {
            disabled: false,
            $push: {
                logs: {
                    title: `Guild enabled`,
                    content: `This guild has been enabled by Team Cura.`,
                    by: user.username
                }
            }
        })
        return f(200, "Guild enabled.");
    }
});

router.get("/:id", checkAuth, async (req, res) => {
    const id = req.params.id;
    let canMod = false;

    const e = (msg) => {
        return res.render('errors/error.ejs', { pageName: "Error", msg, user: req.user });
    }

    if(!id) return e("Invalid id passed!");

    const guild = await guildModel.findOne({ id: id, users: req.user.id });
    if(!guild) return e("You must be in this guild to view this page.");
    if(guild.disabled) return e("This guild has been disabled.");

    if(guild.owner == req.user.id) canMod = true;

    const channels = await dmModel.find({ guild: id, type: 1 });

    const guilds = await guildModel.find({ users: req.user.id }); 

    let data = {
        pageName: `${guild.name}`,
        user: req.user,
        channels,
        guild,
        guilds: guilds.reverse(),
        members: guild.users.reverse().slice(0, 5),
        canMod
    }

    return res.render('app/guild/view.ejs', data);
});

// ? Tools
async function checkAuth(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }

    return res.render('errors/error.ejs', { pageName: "Error", msg: "You must be logged in to access this page!", user: req.user })
}

async function checkNotAuth(req, res, next){
    if(req.isAuthenticated()){
        return res.status(401).send({
            code: 401,
            msg: "You must be logged out to call this."
        })
    }
    next();
}

module.exports = router