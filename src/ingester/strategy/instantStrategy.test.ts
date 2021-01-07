import axios from 'axios'
import nock from 'nock'
import {waitTime} from '../../utils'
import GroupStrategy from './groupStrategy'

const uri = 'https://ingestion.com'
const path = '/collector'
const api = nock(uri)
const ingestionURL = `${uri}${path}`
import {version} from '../../../package.json'

const id = Math.floor(Math.random() * Math.floor(100)).toString()
const sdkInfo = {name: 'testjs', version}
const ingestionData = {
  entities: [{id}],
  events: [
    {
      name: 'Purchase Completed',
      properties: {
        plan: 'Bronze',
        referrer: 'www.Google.com',
        shirt_size: 'medium'
      },
      entity: {id},
      timestamp: new Date().toISOString()
    }
  ],
  sdkInfo
}

describe('instant ingestion Strategy tests', () => {
  it('ingest sends data to server before 100ms has passed', async () => {
    const strategy = new GroupStrategy({
      ingestionURL,
      ingestionMaxCalls: 1,
      sdkInfo,
      sendDataFunction: axios.post
    })

    const trackCallback = jest.fn()
    api
      .post(path)
      .once()
      .reply(200, (_, body: Body) => {
        trackCallback(body)
      })

    strategy.ingest(ingestionData)

    // wait for ingestion to happen
    await waitTime(100)

    expect(trackCallback.mock.calls[0][0].events[0].entity).not.toEqual(null)
    expect(trackCallback.mock.calls[0][0].events[0].entity.id).toEqual(id)
    expect(trackCallback.mock.calls[0][0].events[0].name).toEqual(
      ingestionData.events[0].name
    )

    await strategy.shutdown()

    api.done()
  })
})
