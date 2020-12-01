import {SSEServer} from 'mock-sse-server'
import nock from 'nock'
import {INGESTION_URL, SOURCE_URL} from './constants'
import Flagger from './index'
import FlaggerConfiguration from './misc/config_example.json'
import Mock = jest.Mock
import {IFlaggerConfiguration} from './Types'

const apiKey = 'testApiKey'

const SSE_PORT = 3103
const sseURL = `http://localhost:${SSE_PORT}/events/`
const sdkInfo = {name: 'js', version: '3.0.0'}

const ingestionUrl = new URL(INGESTION_URL)
const ingestionScope = nock(ingestionUrl.origin)
const ingestionPathname = ingestionUrl.pathname + apiKey

describe('track tests', () => {
  let sseServer: SSEServer<IFlaggerConfiguration>
  let ingestionCallback: Mock

  const id = Math.floor(Math.random() * Math.floor(100)).toString()

  beforeEach(async () => {
    sseServer = new SSEServer<IFlaggerConfiguration>(SSE_PORT)
    await sseServer.start()

    ingestionCallback = jest.fn()
    ingestionScope.post(ingestionPathname).reply(200, (_, body: any) => {
      ingestionCallback(body)
    })

    nock(SOURCE_URL)
      .get('/' + apiKey)
      .reply(200, FlaggerConfiguration)

    await Flagger.init({
      apiKey,
      sdkInfo,
      sseURL
    })
  })

  afterEach(async () => {
    await sseServer.stop()
  })

  it('track event with entity', async () => {
    Flagger.track(
      'Purchase Completed',
      {
        plan: 'Bronze',
        referrer: 'www.Google.com',
        shirt_size: 'medium'
      },
      {id}
    )
    await Flagger.shutdown()
    expect(ingestionCallback).toBeCalledTimes(1)
    expect(ingestionCallback.mock.calls[0][0].events.length).toEqual(1)
    expect(ingestionCallback.mock.calls[0][0].events[0].entity).not.toEqual(
      null
    )
    expect(ingestionCallback.mock.calls[0][0].events[0].entity.id).toEqual(id)
  })
  it('track event with entity set before', async () => {
    Flagger.setEntity({id})

    Flagger.track('Purchase Completed', {
      plan: 'Gold',
      referrer: 'www.Google.com',
      shirt_size: 'medium'
    })
    await Flagger.shutdown()

    expect(ingestionCallback).toBeCalledTimes(1)
    expect(ingestionCallback.mock.calls[0][0].events.length).toEqual(1)
    expect(ingestionCallback.mock.calls[0][0].events[0].entity).toBeTruthy()
    expect(ingestionCallback.mock.calls[0][0].events[0].entity.id).toEqual(id)
  })
})
