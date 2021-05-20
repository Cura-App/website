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

router.post("/new", async (req, res) => {
    const sid = req.header("sid");
    const name = req.body.name;

    // ? Dont forget to check if the author is a bot etc
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

    if(!sid) return f(400, "Action Not Allowed");
    if(!name) return f(400, "Please provide a name for the bot!");
    if(name.length > 50) return f(400, "Max name length is 50 characters!");

    const user = await userModel.findOne({
        sid: sid,
        bot: false,
        disabled: false,
        terminated: false
    });

    if(!user) return f(401, "Action Not Allowed");

    const bots = await userModel.find({ 
        owner: user.id,
        bot: true
    });

    if(bots.length >= 3) return f(401, "You can only have 3 bots at a time!");

    const verifyCode = `bt:` + uuidv4(); 
    const RandomId =  "-" + shortid.generate();
    const fullId = Date.now() + RandomId;
    const friendId = shortid.generate();

    const hashedPassword = await bcrypt.hash(verifyCode + uuidv4(), 10);

    const newUser = new userModel({ 
        id: fullId, 
        friendId: friendId,
        username: name, 
        email: name + friendId, 
        sid: verifyCode,
        password: hashedPassword,
        owner: user.id,
        bot: true,
        terminated: false
     });
    await newUser.save();

    return f(200, fullId);
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