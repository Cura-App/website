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

router.get("/", checkAuth, async (req, res) => {
    const friends = await userModel.find({ friends: req.user.id });

    const guilds = await guildModel.find({ users: req.user.id }); 

    return res.render("app/home.ejs", {
        pageName: `@${req.user.username}`,
        user: req.user,
        friends,
        guilds: guilds.reverse(),
        activeChannel: 0
    })
});

router.get("/settings", checkAuth, async (req, res) => {
    const guilds = await guildModel.find({ users: req.user.id }); 

    return res.render("app/settings.ejs", {
        pageName: `Settings`,
        user: req.user,
        guilds: guilds.reverse()
    })
});

router.get("/friends/requests", checkAuth, async (req, res) => {
    const user = req.user;

    const requests = await userModel.find({
        pending: user.id
    });
    const guilds = await guildModel.find({ users: req.user.id }); 

    return res.render('app/requests.ejs', { pageName: "Friend Requests", user, requests, guilds: guilds.reverse() })
})

router.get("/add", checkAuth, async (req, res) => {
    const guilds = await guildModel.find({ users: req.user.id }); 

    return res.render("app/add-friend.ejs", {
        pageName: `@${req.user.username}`,
        user: req.user,
        activeChannel: 0,
        guilds: guilds.reverse()
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