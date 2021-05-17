const { v4: uuidv4 } = require('uuid');
const shortId = require('shortid');

module.exports = () => {
    return 'x' + uuidv4() + shortId.generate() + Date.now() + uuidv4();
}