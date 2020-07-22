import nock from 'nock'
import {SOURCE_URL} from './constants'
import Flagger from './index'
import {IEvent} from './ingester/Interfaces'
import FlaggerConfiguration from './misc/config_example.json'

const apiKey = '12345qwerty'
const api = nock('http://localhost')
const uri = '/track'
const ingestionURL = 'http://localhost/track'
const sourceURL = SOURCE_URL // Flagger.init overrides previous values => must provide sourceURL every init
let scope: nock.Scope

beforeAll(() => {
  scope = nock(SOURCE_URL)
    .get('/' + apiKey)
    .reply(200, FlaggerConfiguration)
    .persist(true)
})

afterAll(() => {
  scope.persist(false)
})

describe('track tests', () => {
  const id = Math.floor(Math.random() * Math.floor(100)).toString()

  it('track event with manually added entity', done => {
    const trackCallback = jest.fn(({events}: {events: IEvent[]}) => {
      expect(events[0].entity).not.toEqual(null)
      if (events[0].entity) {
        expect(events[0].entity.id).toEqual(id)
      }
      Flagger.shutdown().then(_ => {
        done()
      })
    })
    api.post(uri).reply(200, (_, body: any) => {
      trackCallback({events: body.events})
    })

    Flagger.init({
      apiKey,
      sourceURL,
      ingestionURL,
      sdkInfo: {name: 'js', version: '3.0.0'}
    }).then(__ => {
      Flagger.track(
        'Purchase Completed',
        {
          plan: 'Bronze',
          referrer: 'www.Google.com',
          shirt_size: 'medium'
        },
        {id}
      )
    })
  })
  it('track event with entity set before', done => {
    const trackCallback = jest.fn(({events}: {events: IEvent[]}) => {
      expect(events[0].entity).not.toEqual(null)
      if (events[0].entity) {
        expect(events[0].entity.id).toEqual(id)
      }
      Flagger.shutdown().then(_ => {
        done()
      })
    })

    api.post(uri).reply(200, (_, body: any) => {
      trackCallback({events: body.events})
    })

    Flagger.init({
      apiKey,
      sourceURL,
      ingestionURL,
      sdkInfo: {name: 'js', version: '3.0.0'}
    }).then(__ => {
      Flagger.setEntity({id})

      Flagger.track('Purchase Completed', {
        plan: 'Gold',
        referrer: 'www.Google.com',
        shirt_size: 'medium'
      })
    })
  })
})