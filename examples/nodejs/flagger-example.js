const FlaggerConfiguration = require('./config.json')

const {Flagger} = require('flagger')
const nock = require('nock')

const apiKey = 'qwerty'

const sourceURL = 'http://someserver.com/'

// mocking server responce
nock(sourceURL)
  .get('/' + apiKey)
  .reply(200, FlaggerConfiguration)

Flagger.init({
  apiKey, // the only required option
  sourceURL, // to force flagger to fetch from nock url
  logLevel: 'warn' // optional, 'error' by default. another option is 'debug', the most verbose one
})
  .then(_ => {
    Flagger.setEntity({id: '14612844'}) // type === 'User' by default
    const isEnabled = Flagger.isEnabled('new-signup-flow')
    const variation = Flagger.getVariation('new-signup-flow')
    if (isEnabled) {
      // show new signup flow
      console.log(variation) // enabled
    }
  })
  .catch(err => {
    console.error(err)
  })
