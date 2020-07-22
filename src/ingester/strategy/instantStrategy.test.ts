import axios from 'axios'
import nock from 'nock'
import {IEvent} from '../Interfaces'
import GroupStrategy from './groupStrategy'

const api = nock('https://ingestion.airdeploy.com')
const uri = '/collector'
const ingestionURL = 'https://ingestion.airdeploy.com/collector'
describe('instant ingestion Strategy tests', () => {
  const id = Math.floor(Math.random() * Math.floor(100)).toString()
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
    sdkInfo: {name: 'js', version: '0.1.0'}
  }

  it('ingest strategy does not send error', done => {
    const strategy = new GroupStrategy({
      ingestionURL,
      ingestionMaxCalls: 1,
      sdkInfo: {name: 'js', version: '3.0.0'},
      sendDataFunction: axios.post
    })

    api.post(uri).reply(200, () => {
      strategy.sendIngestionNow().then(_ => {
        done()
      })
    })

    strategy.ingest(ingestionData)
  })

  it('ingest sends data to server', done => {
    const strategy = new GroupStrategy({
      ingestionURL,
      ingestionMaxCalls: 1,
      sdkInfo: {name: 'js', version: '3.0.0'},
      sendDataFunction: axios.post
    })

    const trackCallback = jest.fn(({events}: {events: IEvent[]}) => {
      expect(events[0].entity).not.toEqual(null)
      if (events[0].entity) {
        expect(events[0].entity.id).toEqual(id)
      }
      expect(events[0].name).toEqual(ingestionData.events[0].name)
      strategy.sendIngestionNow().then(_ => {
        done()
      })
    })

    api.post(uri).reply(200, (_, body: any) => {
      trackCallback({events: body.events})
    })

    strategy.ingest(ingestionData)
  })
})
