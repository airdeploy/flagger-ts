import {SSEServer} from 'mock-sse-server'
import nock from 'nock'
import {INGESTION_URL, SOURCE_URL} from './constants'
import {Flagger} from './Flagger'
import conf from './misc/config_example.json'
import emptyConf from './misc/empty_config_example.json'
import SSE from './sse'
import {IFlaggerConfiguration} from './Types'
import {wait, waitTime} from './utils'

const config: IFlaggerConfiguration = conf as IFlaggerConfiguration
const emptyConfig: IFlaggerConfiguration = emptyConf as IFlaggerConfiguration

const apiKey = 'testApiKey'

const SSE_PORT = 3102
const sseURL = `http://localhost:${SSE_PORT}/events/`

let scope: nock.Scope
const ingestionUrl = new URL(INGESTION_URL)
const ingestionScope = nock(ingestionUrl.origin)
const ingestionPathname = ingestionUrl.pathname + apiKey

describe('sse tests', () => {
  let sseServer: SSEServer<IFlaggerConfiguration>

  beforeAll(async () => {
    scope = nock(SOURCE_URL)
      .get('/' + apiKey)
      .reply(200, config)
      .persist(true)

    sseServer = new SSEServer<IFlaggerConfiguration>(SSE_PORT)
    await sseServer.start()
  })

  afterAll(async () => {
    scope.persist(false)
    await sseServer.stop()
  })

  it('listener gets new config via sse', async () => {
    const newCodename = 'someNewCodename'
    const listener = jest.fn()
    await Flagger.init({
      apiKey,
      sseURL
    })

    Flagger.addFlaggerConfigUpdateListener(listener)

    const sseConfig = JSON.parse(JSON.stringify(config)) // clone
    if (sseConfig.flags) {
      sseConfig.flags[0].codename = newCodename
    }

    // push new data via sse with a delay
    await wait(() => {
      sseServer.pushNewData(sseConfig, 'flagConfigUpdate')
    }, 100)

    // wait for the data to be consumed by the flagger
    await waitTime(1000)

    await Flagger.shutdown()
    Flagger.removeFlaggerConfigUpdateListener(listener)

    expect(listener).toBeCalled()
    expect(listener.mock.calls[0][0].sdkConfig).toBeDefined()
    expect(listener.mock.calls[0][0].hashKey).toBeDefined()
    expect(listener.mock.calls[0][0].flags.length).toBeGreaterThan(0)
    expect(listener.mock.calls[0][0].flags[0].codename).toEqual(newCodename)
  })

  it('does not trigger flagConfigUpdate event if new config is the same as the current one', async () => {
    const listener = jest.fn()
    await Flagger.init({
      apiKey,
      sseURL
    })

    Flagger.addFlaggerConfigUpdateListener(listener)

    // push the same config
    await wait(() => {
      sseServer.pushNewData(config, 'flagConfigUpdate')
    }, 1000)

    // wait for the data to be consumed by the flagger
    await waitTime(1000)

    await Flagger.shutdown()

    expect(listener).not.toBeCalled()
    Flagger.removeFlaggerConfigUpdateListener(listener)
  })

  it('KEEPALIVE, should check that connection is open', async () => {
    const sseInstance = new SSE()
    const updateLastSSEConnectionTime = jest.fn()
    // ignoring because updateLastSSEConnectionTime is a private function
    // @ts-ignore
    sseInstance.updateLastSSEConnectionTime = updateLastSSEConnectionTime
    sseInstance.init(() => {
      // ignoring results of a callback
    }, `${sseURL}${apiKey}`)
    // wait for client to connect

    await wait(() => {
      sseServer.keepalive()
    }, 100)

    await wait(() => {
      expect(updateLastSSEConnectionTime).toHaveBeenCalled()
      expect(updateLastSSEConnectionTime).toHaveBeenCalledTimes(2)
    }, 100)

    sseInstance.disconnect()
  })

  it('Check that new config is pushed', async () => {
    const sseInstance = new SSE()
    const sseCallback = jest.fn()

    sseInstance.init(sseCallback, `${sseURL}${apiKey}`)
    // connect
    await waitTime(100)

    sseServer.pushNewData(config, 'flagConfigUpdate')
    sseServer.pushNewData(emptyConfig, 'flagConfigUpdate')

    // wait for the changes
    await waitTime(100)

    sseInstance.disconnect()
    expect(sseCallback).toBeCalledTimes(2)
    expect(sseCallback.mock.calls[0][0].hashKey).toEqual(config.hashKey)
    expect(sseCallback.mock.calls[1][0].hashKey).toEqual(emptyConf.hashKey)
  })

  it('flag isEnabled ==> true, but when new config is pushed isEnabled == false', async () => {
    ingestionScope
      .post(ingestionPathname)
      .twice()
      .reply(200)

    await Flagger.init({
      apiKey,
      sseURL
    })

    // connect
    await waitTime(100)

    expect(Flagger.isEnabled('new-signup-flow', {id: '90843823'})).toEqual(true) // whitelisted

    // updating config
    sseServer.pushNewData(emptyConfig, 'flagConfigUpdate')

    // wait for the config to update
    await waitTime(100)

    expect(Flagger.isEnabled('new-signup-flow', {id: '90843823'})).toEqual(
      false
    ) // blacklisted

    await Flagger.shutdown()
  })

  it('disconnect func stops server from pushing new config', async () => {
    const sseInstance = new SSE()
    const callback = jest.fn()

    sseInstance.init(callback, `${sseURL}${apiKey}`)

    sseInstance.disconnect()

    // wait for client to connect
    await wait(() => {
      sseServer.pushNewData(config, 'flagConfigUpdate')
      sseServer.pushNewData(emptyConfig, 'flagConfigUpdate')
    }, 500)

    // wait for the server to actually push the data
    await wait(() => {
      expect(callback).toHaveBeenCalledTimes(0)
    }, 100)
  })
})
