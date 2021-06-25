const { Schema, model } = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const idKey = uuidv4();


const premium = Schema({
    id: {
        type: String,
        default: Date.now(),
        unique: true
    },
    code: {
        type: String,
        unique: true
    },
    from: {
        type: String // ? Username (static)
    },
    claimed: {
        type: Boolean,
        default: false
    }
});

module.exports = model('premium', premium);