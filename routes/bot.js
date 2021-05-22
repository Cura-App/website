const express = require('express');
const router = express.Router();


// ? Models 
const userModel = require('../models/user');
const guildModel = require('../models/guild');

// ? Packages
const rateLimit = require("express-rate-limit");
const formidable = require('formidable');
const shortid = require('shortid');
const fs = require('fs');
const mv = require('mv');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const eventManager = require('../socket/events');
const event = new eventManager();

// ? other imports
const io = require("../socket/server").io;


const usernameRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    handler: function (req, res) {
        return res.status(429).send({
            code: 429,
            msg: "Please take it slow!"
        });
    }
});

router.get("/authorize", checkAuth, async (req, res) => {
    const user = req.user;
    const appId = req.query.app_id;
    const permission = req.query.perm;

    const perms = ["admin", "moderator", "user"];

    const e = (msg) => {
        return res.render('errors/error.ejs', { pageName: "Error", msg, user: req.user });
    }

    if(user.disabled || user.terminated) return e("Action Not Allowed");

    if(!appId) return e("Invalid app_id!");
    if(!permission) return e("Invalid permission!");
    if(!perms.includes(permission)) return e("Invalid permission, must be either: admin, moderator or user!");

    const bot = await userModel.findOne({ id: appId, bot: true, terminated: false, disabled: false });
    if(!bot) return e("Bot was not found!");

    // Must be admin to add bot to guild!
    const guilds = await guildModel.find({ admins: user.id, disabled: false });

    const data = { 
        pageName: "Add " + bot.username, 
        user: user,
        guilds,
        bot,
        perm: permission
    }

    return res.render('home/add-bot.ejs', data);
});

router.post("/authorize", async (req, res) => {
    const sid = req.header("sid");
    const appId = req.query.app_id;
    const permission = req.query.perm;
    const selected = req.query.guild;

    const perms = ["admin", "moderator", "user"];

    const e = (msg) => {
        return res.status(401).send({ 
            code: 401,
            msg
        })
    }

    if(!sid) return e("Action Not Allowed");

    const user = await userModel.findOne({ sid: sid });
    if(!user) return e("Action Not Allowed");

    if(user.disabled || user.terminated) return e("Action Not Allowed");

    if(!appId) return e("Invalid app_id!");
    if(!permission) return e("Invalid permission!");
    if(!perms.includes(permission)) return e("Invalid permission, must be either: admin, moderator or user!");
    if(!selected) return e("No guild selected!");

    const bot = await userModel.findOne({ id: appId, bot: true, terminated: false, disabled: false });
    if(!bot) return e("Bot was not found!");

    // Must be admin to add bot to guild!
    const guild = await guildModel.findOne({ id: selected, admins: user.id });
    if(!guild) return e("This guild was not found!");

    if(guild.users.includes(bot.id)) return e("Bot is already a member of this guild!");

    if(permission == "admin"){
        await guildModel.findOneAndUpdate({
            id: guild.id,
            admins: user.id
        }, {
            $push: {
                admins: bot.id,
                mods: bot.id,
                users: bot.id
            }
        });
    } else if(permission == "moderator"){
        await guildModel.findOneAndUpdate({
            id: guild.id,
            admins: user.id
        }, {
            $push: {
                mods: bot.id,
                users: bot.id
            }
        });
    } else {
        await guildModel.findOneAndUpdate({
            id: guild.id,
            admins: user.id
        }, {
            $push: {
                users: bot.id
            }
        });
    }

    event.newGuild({
        guild: {
            id: guild.id,
            name: guild.name
        },
        user: {
            id: user.id,
            username: user.username
        }
    });

    return res.status(200).send({
        code: 200,
        msg: guild.id,
        json: {
            guild: {
                id: guild.id,
                name: guild.name
            },
            user: {
                id: bot.id,
                username: bot.username
            }
        }
    })
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