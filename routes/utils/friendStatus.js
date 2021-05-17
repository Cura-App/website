const userModel = require('../../models/user');

module.exports = async (req, res) => {

    const sid = req.header('sid');
    const id = req.query.id; // ? target user friendId
    let action = req.params.action;

    const fin = (code, msg, json) => {
        const endCode = code ? code : 501;
        const endMsg = msg ? msg : 501;
        const endJson = json ? json : null;

        return res.status(code).send({
            code: endCode, 
            msg: endMsg,
            json: endJson
        })
    }

    if(!sid) return fin(400, "No sid provided.");
    if(!id) return fin(400, "No id provided.");
    if(!action) return fin(400, "No action provided.");

    action = action.toLowerCase();

    const user = await userModel.findOne({ sid: sid });
    if(!user) return fin(401, "Action Not Allowed.");

    if(user.disabled) return fin(401, "Action Not Allowed.");
    if(user.terminated) return fin(401, "Action Not Allowed.");

    const target = await userModel.findOne({ friendId: id });
    if(!target) return fin(404, "User not found!")
    if(target.disabled) return fin(400, "This user has been disabled and cannot get added as friend!");
    if(target.terminated) return fin(400, "This user has been terminated and cannot get added as friend!");

    if(target.id == user.id) return fin(401, "You can't friend yourself.. :(")

    const pending = user.pending;
    const tpending = target.pending;

    switch(action){
        case "request":
            if(pending.includes(target.id)) return fin(401, "Request already pending!");
            if(tpending.includes(user.id)) return fin(401, "Request already pending!");

            if(user.friends.includes(target.id)) return fin(401, "You are already friends with this user!");
            if(target.friends.includes(user.id)) return fin(401, "You are already friends with this user!");

            await userModel.findOneAndUpdate({ // ? Update friend model
                id: target.id
            }, {
                $push: {
                    requests: user.id
                }
            });
            await userModel.findOneAndUpdate({ // ? Update user model
                id: user.id
            }, {
                $push: {
                    pending: target.id
                }
            });

            return fin(200, "Friend request pending!")

        case "accept":
            if(!user.requests.includes(target.id)) return fin(401, "Please send this user a friend request first!");
            if(!tpending.includes(user.id)) return fin(401, "Please send this user a friend request first!");
        
            await userModel.findOneAndUpdate({ // ? Update friend model
                id: target.id
            }, {
                $pull: {
                    pending: user.id
                },
                $push: {
                    friends: user.id
                }
            });
            await userModel.findOneAndUpdate({ // ? Update user model
                id: user.id
            }, {
                $pull: {
                    requests: target.id
                },
                $push: {
                    friends: target.id
                }
            });

            return fin(200, "Friend request accepted!")

        case action:
            return fin()
    }
}