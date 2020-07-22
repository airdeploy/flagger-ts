import {SSEServer} from 'mock-sse-server'
import nock from 'nock'
import {SOURCE_URL} from './constants'
import {Flagger} from './Flagger'
import conf from './misc/config_example.json'
import emptyConf from './misc/empty_config_example.json'
import SSE from './sse'
import {IFlaggerConfiguration} from './Types'
import {wait} from './utils'

const config: IFlaggerConfiguration = conf as IFlaggerConfiguration
const emptyConfig: IFlaggerConfiguration = emptyConf as IFlaggerConfiguration

const SSE_PORT = 3103
const apiKey = '12345qwerty'
const sourceURL = SOURCE_URL // Flagger.init overrides previous values => must provide sourceURL every init

let scope: nock.Scope

beforeAll(() => {
  scope = nock(SOURCE_URL)
    .get('/' + apiKey)
    .reply(200, config)
    .persist(true)
})

afterAll(() => {
  scope.persist(false)
})

describe('sse tests', () => {
  it('addFlaggerConfigUpdateListener test', async () => {
    const sseServer = new SSEServer<IFlaggerConfiguration>(SSE_PORT)
    await sseServer.start()
    const flaggerConfigurationUpdateListener = (
      newConfig: IFlaggerConfiguration
    ) => {
      expect(newConfig).toHaveProperty('sdkConfig')
      expect(newConfig).toHaveProperty('hashKey')
      expect(newConfig).toHaveProperty('flags')
      Flagger.removeFlaggerConfigUpdateListener(
        flaggerConfigurationUpdateListener
      )
    }
    Flagger.addFlaggerConfigUpdateListener(flaggerConfigurationUpdateListener)
    await Flagger.init({
      apiKey,
      sourceURL,
      sseURL: 'http://localhost:' + SSE_PORT + '/events/'
    })

    await wait(() => {
      sseServer.pushNewData(config, 'flagConfigUpdate')
    }, 100)
    await Flagger.shutdown()
    await sseServer.stop()
  })

  it('KEEPALIVE, should check that connection is open', async () => {
    const sseServer = new SSEServer<IFlaggerConfiguration>(SSE_PORT)
    await sseServer.start()
    const sseInstance = new SSE()
    const updateLastSSEConnectionTime = jest.fn()
    // ignoring because updateLastSSEConnectionTime is a private function
    // @ts-ignore
    sseInstance.updateLastSSEConnectionTime = updateLastSSEConnectionTime
    sseInstance.init(() => {
      // ignoring results of a callback
    }, `http://localhost:${SSE_PORT}/events/${apiKey}`)
    // wait for client to connect

    await wait(() => {
      sseServer.keepalive()
    }, 100)

    await wait(() => {
      expect(updateLastSSEConnectionTime).toHaveBeenCalled()
      expect(updateLastSSEConnectionTime).toHaveBeenCalledTimes(2)
    }, 100)

    sseInstance.disconnect()
    await sseServer.stop()
  })

  it('Check that new config is pushed', async () => {
    const sseServer = new SSEServer<IFlaggerConfiguration>(SSE_PORT)
    await sseServer.start()
    const sseInstance = new SSE()
    let counter = 0
    sseInstance.init((flagConfig: IFlaggerConfiguration) => {
      if (counter === 0) {
        counter++
        expect(flagConfig.hashKey).toEqual(config.hashKey)
      } else {
        expect(flagConfig.hashKey).toEqual(emptyConfig.hashKey)
      }
    }, `http://localhost:${SSE_PORT}/events/${apiKey}`)
    // wait for client to connect
    await wait(() => {
      sseServer.pushNewData(config, 'flagConfigUpdate')
      sseServer.pushNewData(emptyConfig, 'flagConfigUpdate')
    }, 500)

    sseInstance.disconnect()
    await sseServer.stop()
  })

  it('flag isEnabled ==> true, but when new config is pushed isEnabled == false', async () => {
    const sseServer = new SSEServer<IFlaggerConfiguration>(SSE_PORT)
    await sseServer.start()

    await Flagger.init({
      apiKey,
      sourceURL,
      sseURL: 'http://localhost:' + SSE_PORT + '/events/'
    })

    // connect
    await wait(() => {
      expect(Flagger.isEnabled('new-signup-flow', {id: '90843823'})).toEqual(
        true
      ) // whitelisted

      // updating config
      sseServer.pushNewData(emptyConfig, 'flagConfigUpdate')
    }, 500)

    // wait for the config to update
    await wait(() => {
      expect(Flagger.isEnabled('new-signup-flow', {id: '90843823'})).toEqual(
        false
      ) // blacklisted
    }, 500)

    await Flagger.shutdown()
    await sseServer.stop()
  })

  it('disconnect func stops server from pushing new config', async () => {
    const sseServer = new SSEServer<IFlaggerConfiguration>(SSE_PORT)
    await sseServer.start()
    const sseInstance = new SSE()
    const callback = jest.fn()

    sseInstance.init(callback, `http://localhost:${SSE_PORT}/events/${apiKey}`)

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

    await sseServer.stop()
  })
})