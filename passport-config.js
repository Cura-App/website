const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const userModel = require('./models/user');
const { v4: uuidv4 } = require('uuid');
const shortId = require('shortid');
const sidGen = require('./utils/sidGen');

function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = async (email, password, done) => {
      const user = await userModel.findOne({ email: email.toLowerCase() });
      if (user == null) {
        return done(null, false, { message: 'No user with that email' })
      }

      try {
        if(await bcrypt.compare(password, user.password)) {
          if(user.disabled){
            return done(null, false, { message: 'Your account has been disabled.' })
          }

          const nsid = sidGen();

          // ? Set new sid
          await userModel.findOneAndUpdate({
            id: user.id
          }, {
            sid: nsid,
            terminated: false
          });

          return done(null, user)
        } else {
          return done(null, false, { message: 'Password incorrect' })
        }
      } catch (e) {
        return done(e)
      }
  }

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser(async (id, done) => {
    return done(null, await userModel.findOne({ id: id }))
  })
}

module.exports = initialize