const { Schema, model } = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const idKey = uuidv4();


const dm = Schema({
    id: {
        type: String,
        default: Date.now(),
        unique: true
    },
    name: String,
    users: Array, // ? Not for guild channels
    guild: {
        type: String,
        default: "none"
    },
    owner: String, // ? Only for group dms
    thread: Array,
    type: {
        type: Number,
        default: 0 // ? 100 = System Channel || 1 = Guild channel
    }
});

module.exports = model('dm', dm);