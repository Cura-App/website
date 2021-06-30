const userModel = require('../models/user');

module.exports = async () => {
    const users = await userModel.find();
    let endUsers = {};

    for(x of users){
        if(x.disabled){
            endUsers[x.id] = populate(null);
        } else {
            endUsers[x.id] = populate(x);
        }
    }
    
    return endUsers;
}

// for messages
function populate(x){
    let JSON = {
        id: 'unavailable-' + Date.now(),
        username: '-'
    }

    if(!x) return JSON;

    JSON.id = x.id;
    JSON.username = x.username;

    return JSON;
}