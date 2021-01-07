require('reflect-metadata') // Monkeypatching Reflect does not happen early enough in tests
const nock = require('nock')

// failing tests for unmatched request
nock.emitter.addListener('no match', req => {
  if (!req.path.startsWith('/skip')) {
    fail(
      `no unmatched requests are allowed\nRequest: ${JSON.stringify(req.path)}`
    )
  }
})
