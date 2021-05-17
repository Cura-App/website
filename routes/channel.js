const express = require('express');
const router = express.Router();


// ? Models 
const userModel = require('../models/user');
const dmModel = require('../models/dm');
const guildModel = require('../models/guild');

// ? Packages
const rateLimit = require("express-rate-limit");
const formidable = require('formidable');
const shortid = require('shortid');
const fs = require('fs');
const mv = require('mv');

// ? Channel view

router.get("/:id", checkAuth, async (req, res) => {
    const id = req.params.id;

    const e = (msg) => {
        return res.render('errors/error.ejs', { pageName: "Error", msg, user: req.user });
    }

    if(!id) return e("Invalid id passed!");

    const dm = await dmModel.findOne({ id: id, users: { $in: [req.user.id] } });
    if(!dm) return e("Channel could not be found!");

    const guilds = await guildModel.find({ users: req.user.id }); 

    let data = {
        pageName: dm.name,
        user: req.user,
        dm,
        guilds: guilds.reverse()
    }

    return res.render('app/channel/view.ejs', data);
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