// tslint:disable: object-literal-sort-keys
import {Core, getHashedValue, Reason} from './Core'
import confMock from './misc/config_example.json'
import {escapeEntity, IFlaggerConfiguration} from './Types'

const defaultEntity = {id: '1'}
const core = new Core(confMock as IFlaggerConfiguration)
const randomNameIsNotInConfig =
  'random-' + Math.floor(Math.random() * Math.floor(10000))

describe('flag is not in config', () => {
  test('isEnabled should be false', () => {
    const flag = core.evaluateFlagProperties(
      randomNameIsNotInConfig,
      defaultEntity
    )
    expect(flag.isEnabled).toEqual(false)
    expect(flag.newFlag).toBeTruthy()
    expect(flag.hashkey).toEqual(undefined)
  })

  test('isSampled should be false', () => {
    const flag = core.evaluateFlagProperties(
      randomNameIsNotInConfig,
      defaultEntity
    )
    expect(flag.isSampled).toEqual(false)
    expect(flag.reason).toEqual(Reason.FLAG_NOT_IN_CONFIG)
  })

  test('payload should be {}', () => {
    const flag = core.evaluateFlagProperties(
      randomNameIsNotInConfig,
      defaultEntity
    )
    expect(flag.payload).toEqual({})
  })

  test('variation should be off', () => {
    const flag = core.evaluateFlagProperties(
      randomNameIsNotInConfig,
      defaultEntity
    )
    expect(flag.variation.codename).toEqual('off')
  })
})

describe('entity is null', () => {
  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(randomNameIsNotInConfig)
    expect(flag.newFlag).toBeFalsy()
  })
  test('isEnabled should be false', () => {
    const flag = core.evaluateFlagProperties(randomNameIsNotInConfig)
    expect(flag.isEnabled).toEqual(false)
  })

  test('isSampled should be false', () => {
    const flag = core.evaluateFlagProperties(randomNameIsNotInConfig)
    expect(flag.isSampled).toEqual(false)
    expect(flag.reason).toEqual(Reason.NO_ENTITY_PROVIDED)
  })

  test('payload should be {}', () => {
    const flag = core.evaluateFlagProperties(randomNameIsNotInConfig)
    expect(flag.payload).toEqual({})
  })

  test('variation should be off', () => {
    const flag = core.evaluateFlagProperties(randomNameIsNotInConfig)
    expect(flag.variation.codename).toEqual('off')
  })
})

describe('edge cases', () => {
  describe('codename is empty', () => {
    const flag = core.evaluateFlagProperties('', {id: '1'})
    test('newFlag should be false', () => {
      expect(flag.newFlag).toBeFalsy()
    })
    test('isEnabled should be false', () => {
      expect(flag.isEnabled).toEqual(false)
    })

    test('isSampled should be false', () => {
      expect(flag.isSampled).toEqual(false)
    })
    expect(flag.reason).toEqual(Reason.CODENAME_IS_EMPTY)

    test('payload should be {}', () => {
      expect(flag.payload).toEqual({})
    })

    test('variation should be off', () => {
      expect(flag.variation.codename).toEqual('off')
    })
  })

  describe('id is empty', () => {
    const flag = core.evaluateFlagProperties('test', {id: ''})
    test('newFlag should be false', () => {
      expect(flag.newFlag).toBeFalsy()
    })
    test('isEnabled should be false', () => {
      expect(flag.isEnabled).toEqual(false)
    })

    test('isSampled should be false', () => {
      expect(flag.isSampled).toEqual(false)
      expect(flag.reason).toEqual(Reason.ID_IS_EMPTY)
    })

    test('payload should be {}', () => {
      expect(flag.payload).toEqual({})
    })

    test('variation should be off', () => {
      expect(flag.variation.codename).toEqual('off')
    })
  })
})

describe("'dynamic-pricing' flag is in config. Kill switch is on(killSwitchEngaged: true)", () => {
  const flagCodename = 'dynamic-pricing'
  test('isEnabled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, defaultEntity)
    expect(flag.isEnabled).toEqual(false)
    expect(flag.reason).toEqual(Reason.KILL_SWITCH_ENGAGED)
    expect(flag.hashkey).not.toEqual(undefined)
  })

  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, defaultEntity)
    expect(flag.newFlag).toBeFalsy()
  })
  test('isSampled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, defaultEntity)
    expect(flag.isSampled).toEqual(false)
  })

  test('payload should be {}', () => {
    const flag = core.evaluateFlagProperties(flagCodename, defaultEntity)
    expect(flag.payload).toEqual({})
  })

  test('variation should be off', () => {
    const flag = core.evaluateFlagProperties(flagCodename, defaultEntity)
    expect(flag.variation.codename).toEqual('off')
  })
})

describe("Individual Blacklist test, 'new-signup-flow' flag is in blacklist for User:19421826", () => {
  const flagCodename = 'new-signup-flow'
  const entity = {type: 'User', id: '19421826'}

  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.newFlag).toBeFalsy()
  })

  test('isEnabled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isEnabled).toEqual(false)
    expect(flag.reason).toEqual(Reason.INDIVIDUAL_BLACKLIST)
    expect(flag.hashkey).not.toEqual(undefined)
  })

  test('isSampled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isSampled).toEqual(false)
  })

  test('payload should be {}', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.payload).toEqual({})
  })

  test('variation should be off', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.variation.codename).toEqual('off')
  })
})

describe("Individual Whitelist test, 'new-signup-flow' flag is in whitelist for type:User; ids:90843823,14612844,64741829; variation: enabled", () => {
  const flagCodename = 'new-signup-flow'
  const entity = {type: 'User', id: '90843823'}

  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.newFlag).toBeFalsy()
  })

  test('isEnabled should be true', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isEnabled).toEqual(true)
    expect(flag.reason).toEqual(Reason.INDIVIDUAL_WHITELIST)
    expect(flag.hashkey).not.toEqual(undefined)
  })

  test('isSampled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isSampled).toEqual(false)
  })

  test('payload should be eq to {"showButtons": true}', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const payload = flag.payload
    expect(payload).not.toBeNull()
    expect((payload as any).showButtons).toEqual(true)
  })

  test(`variation should be eq to {
        "codename": "enabled",
        "probability": 1.0,
        "payload": {
            "showButtons": true
        }
    }`, () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const variation = flag.variation
    expect(variation).not.toBeNull()
    expect(variation.codename).toEqual('enabled')
    expect(variation.probability).toEqual(1.0)
    expect(variation.payload).not.toBeNull()
    expect(variation.payload.showButtons).toEqual(true)
  })
})

describe("Group Blacklist test, 'premium-support' flag has group blacklist for Company:52272353", () => {
  const flagCodename = 'premium-support'
  const entity = {
    type: 'User',
    id: '19421826',
    group: {type: 'Company', id: '52272353'}
  }

  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.newFlag).toBeFalsy()
  })

  test('isEnabled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isEnabled).toEqual(false)
    expect(flag.reason).toEqual(Reason.GROUP_BLACKLIST)
    expect(flag.hashkey).not.toEqual(undefined)
  })

  test('isSampled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isSampled).toEqual(false)
  })

  test('payload should be {}', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.payload).toEqual({})
  })

  test('variation should be off', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.variation.codename).toEqual('off')
  })
})

describe("Group whitelist test, 'enterprise-dashboard' flag has group whitelist for Company:31404847", () => {
  const flagCodename = 'enterprise-dashboard'
  const entity = {
    type: 'User',
    id: '19421826',
    group: {type: 'Company', id: '31404847'}
  }

  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.newFlag).toBeFalsy()
  })

  test('isEnabled should be true', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isEnabled).toEqual(true)
    expect(flag.reason).toEqual(Reason.GROUP_WHITELIST)
    expect(flag.hashkey).not.toEqual(undefined)
  })

  test('isSampled should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isSampled).toEqual(false)
  })

  test('payload should be on', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const payload = flag.payload
    expect(payload).not.toBeNull()
    expect(payload.newFeature).toEqual('on')
  })

  test('variation should be enabled, newFeature:on', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const variation = flag.variation
    expect(variation).not.toBeNull()
    expect(variation.codename).toEqual('enabled')
    expect(variation.probability).toEqual(1.0)
    expect(variation.payload).not.toBeNull()
    expect(variation.payload.newFeature).toEqual('on')
  })
})

describe('individual policy always beats group policy', () => {
  // &Entity{ID: "31", Type: "User", Group: &Group{ID: "37", Type: "Group"}}
  it(' Whitelist entity + Blacklist group => isEnabled true', () => {
    const entity = {id: '31', type: 'User', group: {id: '37', type: 'Company'}}
    const iFlagResult = core.evaluateFlagProperties('policy-test-wl', entity)
    expect(iFlagResult.isEnabled).toBe(true)
  })
  it('whitelist group + blacklist entity => flag is off', () => {
    const entity = {id: '31', type: 'User', group: {id: '37', type: 'Company'}}
    const iFlagResult = core.evaluateFlagProperties('policy-test-bl', entity)
    expect(iFlagResult.isEnabled).toBe(false)
  })
})

describe('Individual subpopulation sample, Single subpopulation of type "User", filtered for Users in Japan or France, sampled at 30%', () => {
  const flagCodename = 'new-signup-flow'
  const entity = {type: 'User', id: '3423', attributes: {country: 'Japan'}}

  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.newFlag).toBeFalsy()
  })

  test('isEnabled should be true', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isEnabled).toEqual(true)
    expect(flag.reason).toEqual(Reason.FLAG_IS_SAMPLED)
    expect(flag.hashkey).not.toEqual(undefined)
  })

  test('isEnabled should be true', () => {
    const userFromFrance = {
      type: 'User',
      id: '3423',
      attributes: {country: 'France'}
    }
    const flag = core.evaluateFlagProperties(flagCodename, userFromFrance)
    expect(flag.isEnabled).toEqual(true)
  })

  test('isEnabled should be false', () => {
    const userFromChina = {
      type: 'User',
      id: '1434300',
      attributes: {country: 'China'}
    }
    const flag = core.evaluateFlagProperties(flagCodename, userFromChina)
    expect(flag.isEnabled).toEqual(false)
  })

  test('isSampled should be true', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isSampled).toEqual(true)
  })

  test('payload should be eq to {"showButtons": true}', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const payload = flag.payload
    expect(payload).not.toBeNull()
    expect(payload.showButtons).toEqual(true)
  })

  test(`variation should be eq to {
        "codename": "enabled",
        "probability": 1.0,
        "payload": {
            "showButtons": true
        }
    }`, () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const variation = flag.variation
    expect(variation).not.toBeNull()
    expect(variation.codename).toEqual('enabled')
    expect(variation.probability).toEqual(1.0)
    expect(variation.payload).not.toBeNull()
    expect(variation.payload.showButtons).toEqual(true)
  })
})

describe('Group subpopulation sample, Single subpopulation of type "User", filtered for Users in Japan or France, sampled at 30%', () => {
  const flagCodename = 'new-signup-flow-group'
  const entity = {
    type: 'User',
    id: '43242',
    group: {type: 'Company', id: '123213'},
    attributes: {country: 'Japan'}
  }

  test('newFlag should be false', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.newFlag).toBeFalsy()
  })

  test('isEnabled should be true', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isEnabled).toEqual(true)
    expect(flag.reason).toEqual(Reason.FLAG_IS_SAMPLED)
    expect(flag.hashkey).not.toEqual(undefined)
  })

  test('isEnabled should be true', () => {
    const userFromFrance = {
      type: 'User',
      id: '1434300',
      group: {type: 'Company', id: '123213'},
      attributes: {country: 'France'}
    }
    const flag = core.evaluateFlagProperties(flagCodename, userFromFrance)
    expect(flag.isEnabled).toEqual(true)
  })

  test('isEnabled should be false', () => {
    const userFromChina = {
      type: 'User',
      id: '1434300',
      group: {type: 'Company', id: '123213'},
      attributes: {country: 'China'}
    }
    const flag = core.evaluateFlagProperties(flagCodename, userFromChina)
    expect(flag.isEnabled).toEqual(false)
  })

  test('isSampled should be true', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    expect(flag.isSampled).toEqual(true)
  })

  test('payload should be eq to {"showButtons": true}', () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const payload = flag.payload
    expect(payload).not.toBeNull()
    expect(payload.showButtons).toEqual(true)
  })

  test(`variation should be eq to {
        "codename": "enabled",
        "probability": 1.0,
        "payload": {
            "showButtons": true
        }
    }`, () => {
    const flag = core.evaluateFlagProperties(flagCodename, entity)
    const variation = flag.variation
    expect(variation).not.toBeNull()
    expect(variation.codename).toEqual('enabled')
    expect(variation.probability).toEqual(1.0)
    expect(variation.payload).not.toBeNull()
    expect(variation.payload.showButtons).toEqual(true)
  })
})

describe('subpoppulation tests', () => {
  test('.getHashedValue() is consistent across all platforms', () => {
    expect(getHashedValue('1434')).toEqual(0.47103858437236173)
    expect(getHashedValue('4310')).toEqual(0.7868047339684145)
    expect(getHashedValue('1434300')).toEqual(0.11996106696333557)
  })
})

describe('escape methods tests', () => {
  test('escape', () => {
    expect(escapeEntity({id: '1'})).toHaveProperty('type', 'User')
    expect(escapeEntity({id: '1'})).toHaveProperty('attributes', {id: '1'})

    expect(escapeEntity({id: '1', name: 'test'})).toHaveProperty('type', 'User')
    expect(escapeEntity({id: '1', name: 'test'})).toHaveProperty('attributes', {
      id: '1',
      name: 'test'
    })

    expect(escapeEntity({id: '1', type: 'Company'})).toHaveProperty(
      'type',
      'Company'
    )
    expect(escapeEntity({id: '1', type: 'Company'})).toHaveProperty(
      'attributes',
      {
        id: '1'
      }
    )

    expect(
      escapeEntity({
        id: '1',
        name: 'Mike',
        attributes: {ID: '432423', NAME: 'John'}
      })
    ).toHaveProperty('attributes', {id: '432423', name: 'John'})
  })
})
