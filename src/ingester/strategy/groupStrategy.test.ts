// tslint:disable: object-literal-sort-keys
import axios from 'axios'
import nock from 'nock'
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

  const ingestionDataDetectedFlag = {
    id: '92e9adb3-080d-4dc1-8050-4cda1169df4d',
    entities: [
      {
        id: '1',
        type: 'User',
        group: {id: '4242', type: 'company', attributes: {id: '4242'}},
        attributes: {id: '1'}
      }
    ],
    exposures: [
      {
        codename: 'example-flags',
        variation: 'off',
        entity: {
          id: '1',
          type: 'User',
          group: {id: '4242', type: 'company', attributes: {id: '4242'}},
          attributes: {id: '1'}
        },
        methodCalled: 'isEnabled',
        timestamp: '2020-11-06T11:16:55.846381+02:00'
      }
    ],
    events: [],
    sdkInfo: {name: 'js', version: '3.0.1'},
    detectedFlag: 'example-flags'
  }

  const sdkInfo = {name: 'nodejs', version: '0.1.0'}
  it('sends ingestion with detected flags without delay', async () => {
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo,
      sendDataFunction: axios.post
    })

    const trackCallback = jest.fn()

    api.post(uri).reply(200, (_, body: any) => {
      trackCallback({detectedFlags: body.detectedFlags})
    })

    strategy.ingest(ingestionDataDetectedFlag)

    await strategy.sendIngestionNow()

    expect(trackCallback).toBeCalledTimes(1)
  })

  it('ingest 500 times to api', async () => {
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo,
      sendDataFunction: axios.post
    })
    const trackCallback = jest.fn()

    for (let i = 0; i < 500; i++) {
      strategy.ingest(ingestionData)
    }

    api.post(uri).reply(200, (_, body: any) => {
      trackCallback({events: body.events})
    })

    await strategy.sendIngestionNow()
    expect(trackCallback).toBeCalledTimes(1)
    expect(trackCallback.mock.calls[0][0].events.length).toBe(500)
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
      },
      sendFirstExposuresThreshold: 0
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

  it('group entity by id and type', async () => {
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
      },
      sendFirstExposuresThreshold: 1000
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

    await strategy.sendIngestionNow()

    expect(count).toEqual(1)
    expect(sentData.entities.length).toEqual(2)
  })
})
