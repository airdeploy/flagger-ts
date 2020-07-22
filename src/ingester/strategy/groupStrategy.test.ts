// tslint:disable: object-literal-sort-keys
import axios from 'axios'
import nock from 'nock'
import {IEvent} from '../Interfaces'
import GroupStrategy from './groupStrategy'
const api = nock('http://localhost')
const uri = '/track'
const ingestionURL = 'http://localhost/track'

describe('Group ingestion Strategy tests', () => {
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

  it('ingest 500 times to api', done => {
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo: {name: 'nodejs', version: '0.1.0'},
      sendDataFunction: axios.post
    })
    const trackCallback = jest.fn(({events}: {events: IEvent[]}) => {
      expect(events.length).toEqual(500)
      strategy.sendIngestionNow().then(_ => {
        done()
      })
    })

    for (let i = 0; i < 500; i++) {
      strategy.ingest(ingestionData)
    }

    api.post(uri).reply(200, (_, body: any) => {
      trackCallback({events: body.events})
    })
  })

  it('Check interval is working properly', done => {
    jest.setTimeout(10000)
    let count = 0
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo: {name: 'nodejs', version: '3.0.0'},
      ingestionIntervalInMilliseconds: 100,
      sendDataFunction: () => {
        count++
        return Promise.resolve()
      }
    })

    // simulating ingestion
    const interval = setInterval(() => {
      strategy.ingest({
        sdkInfo: {version: 'nodejs', name: '3.0.0'},
        entities: [{id: 'id'}],
        exposures: [
          {
            codename: 'test',
            variation: 'isEnabled',
            entity: {id: 'id'},
            hashkey: 'test',
            methodCalled: 'isEnabled',
            timestamp: new Date().toISOString()
          }
        ]
      })
    }, 10)

    setTimeout(() => {
      strategy.setIngestionInterval(1000)
    }, 310)

    setTimeout(() => {
      expect(count).toEqual(6)
      strategy.sendIngestionNow().then(_ => {
        clearInterval(interval)
        done()
      })
    }, 3410)
  })

  it('filter out empty ingestion requests', done => {
    let count = 0
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo: {name: 'nodejs', version: '3.0.0'},
      ingestionMaxCalls: 1,
      sendDataFunction: () => {
        count++
        return Promise.resolve()
      }
    })

    const interval = setInterval(() => {
      strategy.ingest({
        sdkInfo: {version: 'nodejs', name: '3.0.0'},
        entities: [],
        exposures: [],
        events: []
      })
    }, 50)

    setTimeout(() => {
      expect(count).toEqual(0)
      strategy.sendIngestionNow().then(_ => {
        clearInterval(interval)
        done()
      })
    }, 1000)
  })

  it('group entity by id and type', done => {
    let count = 0
    let sentData: any
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo: {name: 'nodejs', version: '3.0.0'},
      ingestionMaxCalls: 2,
      sendDataFunction: (_, data) => {
        count++
        sentData = data
        return Promise.resolve()
      }
    })

    strategy.ingest({
      sdkInfo: {version: 'nodejs', name: '3.0.0'},
      entities: [{id: '1', type: 'User'}],
      exposures: [],
      events: []
    })

    strategy.ingest({
      sdkInfo: {version: 'nodejs', name: '3.0.0'},
      entities: [{id: '1', type: 'Company'}],
      exposures: [],
      events: []
    })

    setTimeout(() => {
      expect(count).toEqual(1)
      expect(sentData.entities.length).toEqual(2)
      strategy.sendIngestionNow().then(_ => {
        done()
      })
    }, 1000)
  })
})
