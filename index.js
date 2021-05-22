const express = require('express');
const app = express();
const httpClient = require('http').Server(app);
require('dotenv').config();
const { connect } = require('mongoose');
const bcrypt = require('bcrypt');
const shortid = require('shortid');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const initializePassport = require('./passport-config');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser')
const MongoStore = require('connect-mongo');
const fs = require('fs');
const fetch = require('node-fetch');

const events = require("./socket/events");
const event = new events();

// ? Variables
const env = process.env;
// ? Functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// ? Models
const userModel = require('./models/user');
const guildModel = require('./models/guild');

// ? CORS
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

app.use(express.static("public"));
initializePassport(
    passport,
    email => user.email,
    id => user.id
)

require('./utils/connectMongo')(connect);

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    store: MongoStore.create({
        mongoUrl: env.MONGO_URL,
        mongoOptions: {
            useUnifiedTopology: true,
            useNewUrlParser: true
        }
    }),
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))
app.use(cookieParser());

// ? Routes
const applicationRoute = require('./routes/me');
app.use('/@me', applicationRoute)

const userRouter = require('./routes/user');
app.use('/@', userRouter)

const botapiRouter = require('./routes/bot-api');
app.use('/bot/api', botapiRouter)

const botRouter = require('./routes/bot');
app.use('/bot', botRouter)

const guildRouter = require('./routes/guild');
app.use('/g', guildRouter)

const channelRouter = require('./routes/channel');
app.use('/channel', channelRouter)


// ? Other core routes
app.get('/', async (req, res) => {
    return res.render('home/index.ejs', { pageName: "Cura", user: req.user })
});

app.get('/docs/:file', (req, res) => {
    let file = req.params.file;

    if(!file) return res.render('errors/error.ejs', { pageName: "Error", msg: "Could not find docs.", user: req.user });

    file = file.toLocaleLowerCase()

    var files = fs.readdirSync('./views/home/docs/');
    let fn = null;

    files.forEach(x => {
        const f = x.substring(0, x.length - 4);
        if(f.toLocaleLowerCase() == file) return fn = f; 
    });

    if(!fn) return res.render('errors/error.ejs', { pageName: "Error", msg: "Could not find docs.", user: req.user })

    let data = {
        pageName: fn,
        user: req.user
    }
    return res.render(`home/docs/${fn}.ejs`, data);
})

// ? Handle guild invites
app.get("/invite/:inv", checkAuth, async (req, res) => {
    const invite = req.params.inv;
    const user = req.user;

    const e = (msg) => {
        return res.render('errors/error.ejs', { pageName: "Error", msg, user: req.user })
    }

    if(user.bot) return e("You must be authorized to join this guild!")
    if(!invite) return e("No invite found!");
    const guild = await guildModel.findOne({ invites: invite, disabled: false });

    if(!guild) return e("Invite is invalid!");

    // ? If invite is valid
    if(guild.users.includes(user.id)) return res.redirect(`/g/${guild.id}`);
    if(guild.banned.includes(user.id)) return e("You are banned from this Guild!");

    // ? Add user as member
    await guildModel.findOneAndUpdate({
        id: guild.id
    }, {
        $push: {
            users: user.id
        }
    });

    return res.redirect(`/g/${guild.id}`);
});

app.get('/login', checkNotAuth, async (req, res) => {
    let loginParam = req.query.next;
    if(!loginParam) loginParam = '/'; 

    let data = {
        pageName: "Login",
        user: req.user,
        emsg: req.flash('error'),
        loginParam
    }
    res.render('home/login.ejs', data);
});

app.get('/logout', (req, res) => {
    if (!req.user) return res.redirect('/login');
    console.log(`[EVENT | LOGOUT] UID=[${req.user.id}]`);
    req.logOut()
    res.redirect('/login');
})

app.get('/register', checkNotAuth, async (req, res) => {
    let data = {
        pageName: "Register",
        user: req.user,
        emsg: null
    }

    res.render('home/register.ejs', data);

});

app.post('/login', checkNotAuth, passport.authenticate('local', {
    successRedirect: '/?e=ref',
    failureRedirect: '/login',
    failureFlash: true
}));


app.post('/register', checkNotAuth, async (req, res) => {
    try {
        const RandomId =  "-" + shortid.generate();
        const field = req.body;
        const hashedPassword = await bcrypt.hash(field.password, 10);

        function callError(msg) {
            let data = {
                pageName: "Register",
                user: req.user,
                emsg: msg
            }

            return res.render('home/register.ejs', data);
        }

        if (!field.name) return callError('Please fill in your username!');
        if (!field.email) return callError('Please fill in your email!');
        if (!field.password) return callError('Please fill in your password!');

        if (field.name.length > 50 || field.name == undefined) return callError('Max username length is 50 characters!')
        if (field.email.length > 50 || field.email == undefined) return callError('Max email length is 50 characters!')
        if (field.password.length < 6 || field.password == undefined) return callError('Minimum password length is 6 characters!')
        const findUser = await userModel.findOne({ email: field.email.toLowerCase() });

        const usernameEx = await userModel.findOne({ username: field.name });
        if(usernameEx) return callError("Username already in use.");

        const safeIdUsername = field.name.replace(/[^A-Z0-9]+/ig, "_").toLowerCase();

        const idExists = await userModel.findOne({ id: RandomId });
        if (idExists) return callError("User with ID already exists!")
        if (findUser) {
            return callError('User with this email exists!')
        } else {
            const verifyCode = uuidv4(); 
            const fullId = Date.now() + RandomId;
            const friendId = shortid.generate();
            const newUser = new userModel({ 
                id: fullId, 
                friendId: friendId,
                username: field.name, 
                bot: false,
                email: field.email, 
                sid: verifyCode,
                password: hashedPassword,
                terminated: false
             });
            await newUser.save();

            return res.redirect('/login');
        }

    } catch (error) {
        console.log(error)
        res.redirect('/');
    }
});

async function checkAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect('/login');
}

async function checkNotAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    next();
}


// ? 404 handlers
app.get('*', (req, res) => {
    return res.render('errors/error.ejs', { pageName: "Error", msg: "Page not found.", user: req.user })
})
app.post('*', (req, res) => {
    return res.status(404).send({ code: 404, msg: "Endpoint not found!" })
})

// ? Error 500 handler
app.use((error, req, res, next) => {
    return res.status(500).render('errors/500.ejs', {
        pageName: `Error 500`,
        user: req.user,
        error: error.toString()
    })
});

var server = httpClient.listen(process.env.port, () => {
    fetch(`https://raw.githubusercontent.com/Cura-App/website/main/package.json`)
        .then(r=>r.json())
            .then(d=> {
                const version = d.version
                const cversion = require('./package.json').version;
                if(version !== cversion){
                    console.log(`\n[WARNING]`, `There is a new version of Cura!\nThe new update might contain a security improvement, please consider upgrading!\n[${cversion} / ${version}]\n`);
                }
            })
    console.log('[INFO]', 'App running on port: ' + process.env.port)
});

module.exports.serverClient = server;

require('./socket/server').run(server);
require('./bot/main').run();
//https://github.com/Cura-App/website