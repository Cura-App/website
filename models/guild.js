const { Schema, model } = require('mongoose');

const guild = Schema({
    id: {
        type: String,
        default: Date.now(),
        unique: true
    },
    name: String,
    invites: Array,
    users: Array, 
    banned: Array,
    owner: String,
    logs: Array,
    disabled: {
        type: Boolean,
        default: false
    },
    official: {
        type: Boolean
    },
    verified: {
        type: Boolean
    }
});

module.exports = model('guild', guild);