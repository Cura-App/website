const express = require('express');
const router = express.Router();

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ? Models 
const userModel = require('../models/user');
const guildModel = require('../models/guild');

// ? Packages
const rateLimit = require("express-rate-limit");
const formidable = require('formidable');
const shortid = require('shortid');
const fs = require('fs');
const mv = require('mv');

router.post("/api/friend-status/:action", (req, res) => {
    return require('./utils/friendStatus')(req,res);
});

router.get("/api/:id", async (req,res) => {
    const id = req.params.id;
    const sid = req.header("sid");

    const f = (code, msg, json) => {
        const endCode = code ? code : 501;
        const endMsg = msg ? msg : "Not Implemented";
        const endJson = json ? json : null;

        return res.status(endCode).send({
            code: endCode,
            msg: endMsg,
            json: endJson
        });
    }

    if(!id) return f(400, "Action Not Allowed");
    if(!sid) return f(400, "Action Not Allowed");

    const user = await userModel.findOne({ sid: sid, disabled: false, terminated: false });
    if(!user) return f(401, "Action Not Allowed");

    const target = await userModel.findOne({ id: id });
    if(!target) return f(404, "User not found");
    if(target.disabled) return f(401, "User not available");
    if(target.terminated) return f(401, "User not available");

    let resData = {
        username: escapeHtml(target.username),
        badges: {
            mod: target.modBadge,
            bugFinder: target.bugBuster
        }
    }

    return f(200, "OK", resData);
})

router.get("/:id", checkAuth, async(req,res)=> {
    const user = req.user;
    const id = req.params.id;

    const err = (msg) => {
        return res.render('errors/error.ejs', { pageName: "Error", msg, user: req.user })        
    }
    
    if(!id) return err("No id provided!");

    const friend = await userModel.findOne({ id: id, disabled: false, terminated: false });
    if(!friend) return err("This user is unavailable!")

    if(friend.id !== user.id){
        if(!friend) return err("Friend was not found!");
        if(!friend.friends.includes(user.id)) return err("You must be this user's friend to view their profile!");
    }

    return res.render('home/user/view.ejs', { pageName: friend.username, friend, user });
})

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