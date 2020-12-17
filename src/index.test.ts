import nock from 'nock'
import {BACKUP_SOURCE_URL, INGESTION_URL, SOURCE_URL} from './constants'
import Flagger, {FlaggerClass, LogLevel} from './index'
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
      sseURL,
      logLevel: LogLevel.debug
    })
    await Flagger.init({
      apiKey,
      sseURL,
      logLevel: LogLevel.error
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
        sseURL,
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
        .thrice()
        .reply(500, callback)

      const backupScope = nock(new URL(BACKUP_SOURCE_URL).origin)
        .get(flagConfigPathname)
        .reply(200, FlaggerConfiguration)

      expect(Flagger.isConfigured()).toBeFalsy()

      await Flagger.init({
        apiKey,
        sseURL
      })

      // since sourceURL and backupURL are the same callCount == 6
      expect(callback).toHaveBeenCalledTimes(3)

      expect(Flagger.isConfigured()).toBeTruthy()
      await Flagger.shutdown()
      scope.done()
      backupScope.done()
    })
  })

  describe('setEntity tests', () => {
    it("setEntity doesn't set invalid entity", async () => {
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
        id: '3423',
        attributes: {country: 'Japan'}
      })

      // not set
      Flagger.setEntity(JSON.parse(JSON.stringify({})))

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
        id: '3423',
        attributes: {country: 'Japan'}
      })
      expect(Flagger.isSampled('new-signup-flow')).toEqual(true)
      await Flagger.shutdown()
      scope.done()
    })
  })

  describe('Multiple instances of flagger', () => {
    it("default instance doesn't affect manually created one", async () => {
      const scope = flagConfigScope
        .get(flagConfigPathname)
        .reply(200, FlaggerConfiguration)

      const f1 = new FlaggerClass()
      const f2 = new FlaggerClass()

      await f1.init({apiKey, sseURL})
      await Flagger.shutdown()

      expect(f1.isConfigured()).toBe(true)
      expect(f2.isConfigured()).toBe(false)
      expect(Flagger.isConfigured()).toBe(false)

      await f1.shutdown()

      expect(f1.isConfigured()).toBe(false)
      expect(f2.isConfigured()).toBe(false)
      expect(Flagger.isConfigured()).toBe(false)
      scope.done()
    })

    it("calling shutdown on manually created instance doesn't affect default", async () => {
      const scope = flagConfigScope
        .get(flagConfigPathname)
        .reply(200, FlaggerConfiguration)

      await Flagger.init({apiKey, sseURL})
      const f1 = new FlaggerClass()

      expect(Flagger.isConfigured()).toBe(true)
      expect(f1.isConfigured()).toBe(false)

      await f1.shutdown()

      expect(Flagger.isConfigured()).toBe(true)
      expect(f1.isConfigured()).toBe(false)

      await Flagger.shutdown()

      expect(Flagger.isConfigured()).toBe(false)
      expect(f1.isConfigured()).toBe(false)

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
    await Flagger.init({apiKey, sseURL})
    const configured = Flagger.isConfigured()
    expect(configured).toBe(true)
  })

  it('returns false after shutdown complete', async () => {
    await Flagger.init({apiKey, sseURL})
    await Flagger.shutdown()
    const configured = Flagger.isConfigured()
    expect(configured).toBe(false)
  })

  it('returns false if shutdown is still in progress', async () => {
    await Flagger.init({apiKey, sseURL})
    const promise = Flagger.shutdown()
    const configured = Flagger.isConfigured()
    await promise
    expect(configured).toBe(false)
  })
})
