import nock from 'nock'
import {SOURCE_URL} from './constants'
import Flagger from './index'
import FlaggerConfiguration from './misc/config_example.json'

const api = nock(SOURCE_URL)

describe('init function tests', () => {
  it('no apiKey provided test', async () => {
    await expect(Flagger.init({apiKey: ''})).rejects.toThrow(
      'No apiKey provided'
    )
  })

  it('Multiple calls of init check', async () => {
    const apiKey = 'fdsfsddds'
    const scope = api
      .get('/' + apiKey)
      .twice()
      .reply(200, FlaggerConfiguration)

    await Flagger.init({
      apiKey
    })
    await Flagger.init({
      apiKey
    })

    await Flagger.shutdown()

    scope.done()
  })

  it('multiple calls of shutdown check', async () => {
    const apiKey = 'somerandomkey12345'
    const scope = api.get('/' + apiKey).reply(200, FlaggerConfiguration)
    await Flagger.init({apiKey})
    await Flagger.shutdown()
    await Flagger.shutdown()
    await Flagger.shutdown()
    scope.done()
  })

  it('sourceURL & backupSource are bad, error is thrown', async () => {
    const apiKey = 'dad23d23r23'
    const scope = api
      .get('/' + apiKey)
      .times(6)
      .reply(500)

    await expect(
      Flagger.init({
        apiKey,
        backupSourceURL: SOURCE_URL
      })
    ).rejects.toThrow()
    await Flagger.shutdown()
    scope.done()
  })

  it('server is actually called', async () => {
    const apiKey = 'fdsfdsf34f2'
    const scope = api.get('/' + apiKey).reply(200, FlaggerConfiguration)
    await Flagger.init({apiKey})
    await Flagger.shutdown()
    scope.done()
  })

  describe('backupURL tests', () => {
    it('should retry sourceURL 3 times', async () => {
      const apiKey = 'fdsf23f2'
      const uri = '/' + apiKey
      const callback = jest.fn()
      const scope = api
        .get(uri)
        .thrice()
        .reply(500, callback)

      api
        .get(uri)
        .thrice()
        .reply(500)

      try {
        // backup url is malformed, so that it wont be called
        await Flagger.init({
          apiKey,
          backupSourceURL: SOURCE_URL
        })
      } catch (err) {
        expect(callback).toHaveBeenCalledTimes(3)
        await Flagger.shutdown()
        scope.done()
      }
    })
    it('should retry sourceURL 3 times and fallback to backupSourceURL', async () => {
      const apiKey = 'h5h455'
      const callback = jest.fn()
      const scope = api
        .get('/' + apiKey)
        .times(6)
        .reply(500, callback)
      try {
        await Flagger.init({
          apiKey,
          backupSourceURL: SOURCE_URL
        })
      } catch (err) {
        // since sourceURL and backupURL are the same callCount == 6
        expect(callback).toHaveBeenCalledTimes(6)
        await Flagger.shutdown()
        scope.done()
      }
    })
  })

  describe('flag tests', () => {
    it('flag isEnabled should be true', async () => {
      const apiKey = 'g35g2g'
      const scope = api.get('/' + apiKey).reply(200, FlaggerConfiguration)

      await Flagger.init({
        apiKey,
        sdkInfo: {name: 'nodejs', version: '0.1.0'}
      })
      Flagger.setEntity({
        // tslint:disable-next-line: object-literal-sort-keys
        id: '3423',
        type: 'User',
        attributes: {country: 'Japan'}
      })
      expect(Flagger.isEnabled('new-signup-flow')).toEqual(true)
      await Flagger.shutdown()
      scope.done()
      nock.cleanAll()
    })

    it('flag isSampled should be true', async () => {
      const apiKey = 'revv3v23h'
      const scope = api.get('/' + apiKey).reply(200, FlaggerConfiguration)

      await Flagger.init({
        apiKey,
        sdkInfo: {name: 'nodejs', version: '0.1.0'}
      })
      Flagger.setEntity({
        // tslint:disable-next-line: object-literal-sort-keys
        id: '3423',
        type: 'User',
        attributes: {country: 'Japan'}
      })
      expect(Flagger.isSampled('new-signup-flow')).toEqual(true)
      await Flagger.shutdown()
      scope.done()
    })
  })
})

describe('isConfigured() tests', () => {
  it('returns true after successful initialization', async () => {
    const apiKey = 'somerandomkey12345'
    const scope = api.get('/' + apiKey).reply(200, FlaggerConfiguration)

    await Flagger.init({apiKey})
    const configured = Flagger.isConfigured()
    scope.done()

    expect(configured).toBe(true)
  })

  it('returns false after shutdown complete', async () => {
    const apiKey = 'somerandomkey12345'
    const scope = api.get('/' + apiKey).reply(200, FlaggerConfiguration)

    await Flagger.init({apiKey})
    await Flagger.shutdown()
    const configured = Flagger.isConfigured()
    scope.done()

    expect(configured).toBe(false)
  })

  it('returns false if shutdown is still in progress', async () => {
    const apiKey = 'somerandomkey12345'
    const scope = api.get('/' + apiKey).reply(200, FlaggerConfiguration)

    await Flagger.init({apiKey})
    const promise = Flagger.shutdown()
    const configured = Flagger.isConfigured()
    await promise
    scope.done()

    expect(configured).toBe(false)
  })
})
