const { Schema, model } = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const idKey = uuidv4();


const User = Schema({
    id: {
        type: String,
        default: Date.now(),
        unique: true
    },
    friendId: {
        type: String,
        unique: true
    },
    icon: {
        type: String,
        default: '/media/user/placeholder.webp'
    },
    username: String,
    email: String,
    owner: String, // ? If the user is a bot add this
    password: String,
    status: {
        type: String,
        default: "OFFLINE"
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    role: {
        type: Number,
        default: 0
    },
    modBadge: {
        type: Boolean,
        default: false
    },
    bot: {
        type: Boolean,
        default: false
    },
    // ? Add premium
    premium: {
        type: String, // ? Premium code
        default: "none"
    },
    owner: {
        type: String
    },
    bugBuster: {
        type: Boolean,
        default: false
    },
    dev: {
        type: Boolean,
        default: false
    },
    friends: Array,
    pending: Array,
    requests: Array,
    disabled: {
        type: Boolean,
        default: false
    },
    terminated: {
        type: Boolean,
        default: false
    },
    sid: { 
        type: String,
        default: 'empty'
    },
    socket: String
});

module.exports = model('User', User);