const metaScraper = require('./metaScraper');
const got = require('got');

module.exports = async (data) => {
    const hasHTTPS = /([https://].*)/.test(data.content);

    if(hasHTTPS){
        try{
            const turl = /([https://].*)/.exec(data.content)[0];

            const { body: html, url } = await got(turl);

            data.embed = await metaScraper({ html, url });
        } catch{}
    }
}