const eventManager = require('events');
const socket = require('./server');

class Client extends eventManager {
    constructor(){
        super();
    }

    newGuild(json){
        this.emit("guild-add", json)
    }
}

module.exports = Client;