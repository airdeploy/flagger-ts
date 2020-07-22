const {Core} = require('flagger')
const config = require('./config.json')
const assert = require('assert').strict

const core = new Core(config)

// entity is whitelisted for the flag
const entity = {id: '90843823', type: 'User'}

const result = core.evaluateFlagProperties('new-signup-flow', entity)
console.log(result.isEnabled) // true
assert(result.variation.codename === 'enabled')
