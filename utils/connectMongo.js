async function connectSite(connect) {
    console.log('[DATABASE] connecting...')
    await connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
        useCreateIndex: true
    }, async (err) => {
        if (err) {
            new Error('[DATABASE]', err)
        } else {
            console.log('[DATABASE]', 'Connection success!')
        }
    });
}

module.exports = connectSite