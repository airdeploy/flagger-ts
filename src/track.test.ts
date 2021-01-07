import nock from 'nock'
import Mock = jest.Mock
import {version} from '../package.json'
import {INGESTION_URL, SOURCE_URL} from './constants'
import Flagger from './index'
import FlaggerConfiguration from './misc/config_example.json'

const apiKey = 'testApiKey'

const SSE_PORT = 3103
const sseURL = `http://localhost:${SSE_PORT}/skip/`

const sdkInfo = {name: 'testjs', version}

const ingestionUrl = new URL(INGESTION_URL)
const ingestionScope = nock(ingestionUrl.origin)
const ingestionPathname = ingestionUrl.pathname + apiKey

describe('track tests', () => {
  let ingestionCallback: Mock

  const id = Math.floor(Math.random() * Math.floor(100)).toString()

  beforeEach(async () => {
    ingestionCallback = jest.fn()
    ingestionScope
      .post(ingestionPathname)
      .twice() // emtpy init + 1 in tests
      .reply(200, (_, body: any) => {
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
    expect(ingestionCallback).toBeCalledTimes(2)
    expect(ingestionCallback.mock.calls[1][0].events.length).toEqual(1)
    expect(ingestionCallback.mock.calls[1][0].events[0].entity).not.toEqual(
      null
    )
    expect(ingestionCallback.mock.calls[1][0].events[0].entity.id).toEqual(id)
  })
  it('track event with entity set before', async () => {
    Flagger.setEntity({id})

    Flagger.track('Purchase Completed', {
      plan: 'Gold',
      referrer: 'www.Google.com',
      shirt_size: 'medium'
    })
    await Flagger.shutdown()

    expect(ingestionCallback).toBeCalledTimes(2)
    expect(ingestionCallback.mock.calls[1][0].events.length).toEqual(1)
    expect(ingestionCallback.mock.calls[1][0].events[0].entity).toBeTruthy()
    expect(ingestionCallback.mock.calls[1][0].events[0].entity.id).toEqual(id)
  })
})
