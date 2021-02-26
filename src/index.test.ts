import nock from 'nock'
import {version} from '../package.json'
import {BACKUP_SOURCE_URL, INGESTION_URL, SOURCE_URL} from './constants'
import Flagger, {FlaggerClass, LogLevel} from './index'
import FlaggerConfiguration from './misc/config_example.json'

const apiKey = 'testApiKey'
const sdkInfo = {name: 'testjs', version}

const SSE_PORT = 3103
const ssePath = '/skip/'
const sseURL = `http://localhost:${SSE_PORT}${ssePath}`

const flagConfigURL = new URL(SOURCE_URL)
const flagConfigScope = nock(flagConfigURL.origin)
const flagConfigPathname = flagConfigURL.pathname + apiKey

const ingestionUrl = new URL(INGESTION_URL)
const ingestionScope = nock(ingestionUrl.origin)
const ingestionPathname = ingestionUrl.pathname + apiKey

const catchIngestion = (times: number): void => {
  ingestionScope
    .post(ingestionPathname)
    .times(times)
    .reply(200)
}

describe('init function tests', () => {
  afterEach(() => {
    flagConfigScope.done()
    ingestionScope.done()
  })

  it('no apiKey provided test', async () => {
    await expect(Flagger.init({apiKey: ''})).rejects.toThrow(
      'You must provide apiKeys: 1) Define FLAGGER_API_KEY environment variable before init() call. 2) Provide apiKey argument to init()'
    )
  })

  it('Multiple calls of init check', async () => {
    catchIngestion(2)
    flagConfigScope
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
  })

  it('multiple calls of shutdown check', async () => {
    catchIngestion(1)
    flagConfigScope.get(flagConfigPathname).reply(200, FlaggerConfiguration)
    await Flagger.init({apiKey, sseURL})
    await Flagger.shutdown()
    await Flagger.shutdown()
    await Flagger.shutdown()
  })

  it('sourceURL & backupSource are bad, error is thrown', async () => {
    catchIngestion(1)
    flagConfigScope
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
  })

  it('server is actually called', async () => {
    catchIngestion(1)
    flagConfigScope.get(flagConfigPathname).reply(200, FlaggerConfiguration)
    await Flagger.init({apiKey, sseURL})
    await Flagger.shutdown()
  })

  describe('backupURL tests', () => {
    it('should retry sourceURL 3 times', async () => {
      catchIngestion(1)
      const callback = jest.fn()
      flagConfigScope
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
      }
    })
    it('should retry sourceURL 3 times and fallback to backupSourceURL', async () => {
      catchIngestion(1)

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
      catchIngestion(2)
      flagConfigScope.get(flagConfigPathname).reply(200, FlaggerConfiguration)

      await Flagger.init({
        apiKey,
        sdkInfo,
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
    })

    it('flag isSampled should be true', async () => {
      catchIngestion(2)

      const scope = flagConfigScope
        .get(flagConfigPathname)
        .reply(200, FlaggerConfiguration)

      await Flagger.init({
        apiKey,
        sdkInfo,
        sseURL
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
      catchIngestion(1)
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
      catchIngestion(1)

      flagConfigScope.get(flagConfigPathname).reply(200, FlaggerConfiguration)

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
    catchIngestion(1)
    await Flagger.init({apiKey, sseURL})
    const configured = Flagger.isConfigured()
    expect(configured).toBe(true)
  })

  it('returns false after shutdown complete', async () => {
    catchIngestion(1)
    await Flagger.init({apiKey, sseURL})
    await Flagger.shutdown()
    const configured = Flagger.isConfigured()
    expect(configured).toBe(false)
  })

  it('returns false if shutdown is still in progress', async () => {
    catchIngestion(1)
    await Flagger.init({apiKey, sseURL})
    const promise = Flagger.shutdown()
    const configured = Flagger.isConfigured()
    await promise
    expect(configured).toBe(false)
  })
})
