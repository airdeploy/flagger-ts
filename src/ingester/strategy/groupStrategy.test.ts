// tslint:disable: object-literal-sort-keys
import axios from 'axios'
import nock from 'nock'
import {waitTime} from '../../utils'
import {IIngestionData} from '../Interfaces'
import GroupStrategy from './groupStrategy'

const api = nock('http://localhost')
const path = '/track'
const ingestionURL = 'http://localhost/track'
import {version} from '../../../package.json'

const sdkInfo = {version, name: 'testjs'}

describe('Group ingestion Strategy tests', () => {
  afterEach(() => {
    api.done()
  })

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
    sdkInfo
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
    sdkInfo,
    detectedFlag: 'example-flags'
  }

  it('sends ingestion with detected flags without delay', async () => {
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo,
      sendDataFunction: axios.post
    })

    const trackCallback = jest.fn()

    api.post(path).reply(200, (_, body: any) => {
      trackCallback({detectedFlags: body.detectedFlags})
    })

    strategy.ingest(ingestionDataDetectedFlag)

    await strategy.shutdown()

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

    api.post(path).reply(200, (_, body: any) => {
      trackCallback({events: body.events})
    })

    await strategy.shutdown()
    expect(trackCallback).toBeCalledTimes(1)
    expect(trackCallback.mock.calls[0][0].events.length).toBe(500)
  })

  it('Check interval is working properly', done => {
    jest.setTimeout(10000)
    let count = 0
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo,
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
        sdkInfo,
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
    }, 350)

    setTimeout(() => {
      expect(count).toEqual(6)
      strategy.shutdown().then(_ => {
        clearInterval(interval)
        done()
      })
    }, 3500)
  })

  it('group entity by id and type', async () => {
    let count = 0
    let sentData: any
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo,
      ingestionMaxCalls: 2,
      sendDataFunction: (_, data) => {
        count++
        sentData = data
        return Promise.resolve()
      },
      sendFirstExposuresThreshold: 1000
    })

    strategy.ingest({
      sdkInfo,
      entities: [{id: '1', type: 'User'}],
      exposures: [],
      events: []
    })

    strategy.ingest({
      sdkInfo,
      entities: [{id: '1', type: 'Company'}],
      exposures: [],
      events: []
    })

    await strategy.shutdown()

    expect(count).toEqual(1)
    expect(sentData.entities.length).toEqual(2)
  })

  it('send empty ingestion', async () => {
    let count = 0
    let sentData: IIngestionData
    const strategy = new GroupStrategy({
      ingestionURL,
      sdkInfo,
      ingestionMaxCalls: 1000,
      sendDataFunction: (_, data) => {
        count++
        sentData = data
        return Promise.resolve()
      }
    })

    strategy.start()

    await waitTime(100)

    expect(count).toEqual(1)
    expect(sentData).toBeDefined()
    if (sentData) {
      expect(sentData.entities.length).toEqual(0)
      expect(sentData.detectedFlags.length).toEqual(0)
      expect(sentData.exposures.length).toEqual(0)
      expect(sentData.sdkInfo).toEqual(sdkInfo)
    }

    await strategy.shutdown()
  })
})
