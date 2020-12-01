import nock from 'nock'
import {INGESTION_URL, SOURCE_URL} from './constants'
import Flagger from './index'
import FlaggerConfiguration from './misc/config_example.json'

const apiKey = 'testApiKey'

const SSE_PORT = 3103
const sseURL = `http://localhost:${SSE_PORT}/events/`

const flagConfigURL = new URL(SOURCE_URL)
const flagConfigScope = nock(flagConfigURL.origin)
const flagConfigPathname = flagConfigURL.pathname + apiKey

const ingestionUrl = new URL(INGESTION_URL)
const ingestionScope = nock(ingestionUrl.origin)
const ingestionPathname = ingestionUrl.pathname + apiKey

describe('init function tests', () => {
  it('no apiKey provided test', async () => {
    await expect(Flagger.init({apiKey: ''})).rejects.toThrow(
      'No apiKey provided'
    )
  })

  it('Multiple calls of init check', async () => {
    const scope = flagConfigScope
      .get(flagConfigPathname)
      .twice()
      .reply(200, FlaggerConfiguration)

    await Flagger.init({
      apiKey,
      sseURL
    })
    await Flagger.init({
      apiKey,
      sseURL
    })

    await Flagger.shutdown()

    scope.done()
  })

  it('multiple calls of shutdown check', async () => {
    const scope = flagConfigScope
      .get(flagConfigPathname)
      .reply(200, FlaggerConfiguration)
    await Flagger.init({apiKey, sseURL})
    await Flagger.shutdown()
    await Flagger.shutdown()
    await Flagger.shutdown()
    scope.done()
  })

  it('sourceURL & backupSource are bad, error is thrown', async () => {
    const scope = flagConfigScope
      .get(flagConfigPathname)
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
    const scope = flagConfigScope
      .get(flagConfigPathname)
      .reply(200, FlaggerConfiguration)
    await Flagger.init({apiKey, sseURL})
    await Flagger.shutdown()
    scope.done()
  })

  describe('backupURL tests', () => {
    it('should retry sourceURL 3 times', async () => {
      const callback = jest.fn()
      const scope = flagConfigScope
        .get(flagConfigPathname)
        .thrice()
        .reply(500, callback)

      flagConfigScope
        .get(flagConfigPathname)
        .thrice()
        .reply(500)

      try {
        // backup url is malformed, so that it wont be called
        await Flagger.init({
          apiKey,
          sseURL,
          backupSourceURL: SOURCE_URL
        })
      } catch (err) {
        expect(callback).toHaveBeenCalledTimes(3)
        await Flagger.shutdown()
        scope.done()
      }
    })
    it('should retry sourceURL 3 times and fallback to backupSourceURL', async () => {
      const callback = jest.fn()
      const scope = flagConfigScope
        .get(flagConfigPathname)
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
      ingestionScope
        .post(ingestionPathname)
        .twice()
        .reply(200)

      const scope = flagConfigScope
        .get(flagConfigPathname)
        .reply(200, FlaggerConfiguration)

      await Flagger.init({
        apiKey,
        sdkInfo: {name: 'nodejs', version: '0.1.0'},
        sseURL
      })

      Flagger.setEntity({
        // tslint:disable-next-line: object-literal-sort-keys
        id: '3423',
        type: 'User',
        attributes: {country: 'Japan'}
      })
      expect(Flagger.isEnabled('new-signup-flow')).toBeTruthy()
      await Flagger.shutdown()
      scope.done()
    })

    it('flag isSampled should be true', async () => {
      ingestionScope.post(ingestionPathname).reply(200)

      const scope = flagConfigScope
        .get(flagConfigPathname)
        .reply(200, FlaggerConfiguration)

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
  let scope: nock.Scope

  beforeEach(() => {
    scope = flagConfigScope
      .get(flagConfigPathname)
      .reply(200, FlaggerConfiguration)
  })

  afterEach(() => {
    scope.done()
  })

  it('returns true after successful initialization', async () => {
    await Flagger.init({apiKey})
    const configured = Flagger.isConfigured()
    expect(configured).toBe(true)
  })

  it('returns false after shutdown complete', async () => {
    await Flagger.init({apiKey})
    await Flagger.shutdown()
    const configured = Flagger.isConfigured()
    expect(configured).toBe(false)
  })

  it('returns false if shutdown is still in progress', async () => {
    await Flagger.init({apiKey})
    const promise = Flagger.shutdown()
    const configured = Flagger.isConfigured()
    await promise
    expect(configured).toBe(false)
  })
})
