import Ajv from 'ajv'
import nock from 'nock'
import {version} from '../package.json'
import {INGESTION_URL, SOURCE_URL} from './constants'
import {axiosInstance} from './Flagger'
import Flagger from './index'
import ingestionSchema from './ingester.schema.json'
import Ingester from './ingester/Ingester'
import {IEvent, IExposure} from './ingester/Interfaces'
import FlaggerConfiguration from './misc/config_example.json'
import {IEntity} from './Types'

const ajv = new Ajv({allErrors: true})
const ingestionValidator = ajv.compile(ingestionSchema)

/*
    Ingestion plugin is a proposition to give a developer 
    an opt-in ability to group ingestion data on Front End in SDK
    before send it to the server
*/
const apiKey = '12345qwerty'
const event = {
  name: 'test',
  properties: {
    plan: 'Bronze',
    referrer: 'www.Google.com',
    shirt_size: 'medium'
  },
  entity: {
    id: '1',
    type: 'Company',
    name: 'ironman@stark.com',
    attributes: {
      tShirtSize: 'M',
      dateCreated: '2018-02-18',
      timeConverted: '2018-02-20T21:54:00.630815+00:00',
      ownsProperty: true,
      age: 39
    },
    group: {
      type: 'Club',
      id: '5678',
      name: 'Avengers Club',
      attributes: {
        founded: '2016-01-01',
        active: true
      }
    }
  },
  timestamp: new Date().toISOString()
}

const JS_SDK_NAME = 'js'
const NODEJS_SDK_NAME = 'nodejs'
const ingestionUrl = new URL(INGESTION_URL)
const api = nock(ingestionUrl.origin)
const uri = ingestionUrl.pathname + apiKey
const sseURL = 'http://localhost/sse'

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

describe('ingestion plugin data test', () => {
  describe('Browser tests', () => {
    it('.track() to events sends data immediately', done => {
      const ingester = new Ingester(
        {name: JS_SDK_NAME, version},
        INGESTION_URL + apiKey,
        axiosInstance
      )
      const trackCallback = jest.fn(({events}: {events: IEvent[]}) => {
        expect(events.length).toEqual(1)
        expect(events[0].entity).not.toEqual(null)
        if (events[0].entity) {
          expect(events[0].entity.id).toEqual(event.entity.id)
        }
        expect(events[0].properties.plan).toEqual(event.properties.plan)
        ingester.sendIngestionNow().then(_ => {
          done()
        })
      })
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({events: body.events})
      })

      ingester.track(event)
    })
    it('.publish() triggers SDK to send data immediately', done => {
      const ingester = new Ingester(
        {name: JS_SDK_NAME, version},
        INGESTION_URL + apiKey,
        axiosInstance
      )

      const trackCallback = jest.fn(({entities}: {entities: IEntity[]}) => {
        expect(entities.length).toEqual(1)
        expect(entities[0].id).toEqual(event.entity.id)
        ingester.sendIngestionNow().then(_ => {
          done()
        })
        done()
      })
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({entities: body.entities})
      })

      ingester.publish(event.entity)
    })
    it('flag.isEnabled() triggers SDK to send data in ~250ms', done => {
      let timestamp: number = 0
      const trackCallback = jest.fn(
        ({
          entities,
          exposures
        }: {
          entities: IEntity[]
          exposures: IExposure[]
        }) => {
          const diff = Date.now() - timestamp
          expect(diff).toBeGreaterThanOrEqual(200)
          expect(diff).toBeLessThan(300)
          expect(entities.length).toEqual(1)
          expect(entities[0].id).toEqual(event.entity.id)
          expect(exposures.length).toEqual(1)
          expect(exposures[0].methodCalled).toEqual('isEnabled')
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({entities: body.entities, exposures: body.exposures})
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: JS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        timestamp = Date.now()
        Flagger.isEnabled('flagger', event.entity)
      })
    })
    it('flag.isSampled() triggers SDK to send data in ~250ms', done => {
      let timestamp: number = 0
      const trackCallback = jest.fn(
        ({
          entities,
          exposures
        }: {
          entities: IEntity[]
          exposures: IExposure[]
        }) => {
          const diff = Date.now() - timestamp
          expect(diff).toBeGreaterThanOrEqual(200)
          expect(diff).toBeLessThan(300)
          expect(entities.length).toEqual(1)
          expect(entities[0].id).toEqual(event.entity.id)
          expect(exposures.length).toEqual(1)
          expect(exposures[0].methodCalled).toEqual('isSampled')
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({entities: body.entities, exposures: body.exposures})
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: JS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        timestamp = Date.now()
        Flagger.isSampled('flagger', event.entity)
      })
    })
    it('flag.getPayload() triggers SDK to send data in ~250ms', done => {
      let timestamp: number = 0
      const trackCallback = jest.fn(
        ({
          entities,
          exposures
        }: {
          entities: IEntity[]
          exposures: IExposure[]
        }) => {
          const diff = Date.now() - timestamp
          expect(diff).toBeGreaterThanOrEqual(200)
          expect(diff).toBeLessThan(300)
          expect(entities.length).toEqual(1)
          expect(entities[0].id).toEqual(event.entity.id)
          expect(exposures.length).toEqual(1)
          expect(exposures[0].methodCalled).toEqual('getPayload')
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({entities: body.entities, exposures: body.exposures})
      })

      Flagger.init({
        apiKey,
        sdkInfo: {name: JS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        timestamp = Date.now()
        Flagger.getPayload('flagger', event.entity)
      })
    })
    it('flag.getVariation() triggers SDK to send data in ~250ms', done => {
      let timestamp: number = 0
      const trackCallback = jest.fn(
        ({
          entities,
          exposures
        }: {
          entities: IEntity[]
          exposures: IExposure[]
        }) => {
          const diff = Date.now() - timestamp
          expect(diff).toBeGreaterThanOrEqual(200)
          expect(diff).toBeLessThan(300)
          expect(entities.length).toEqual(1)
          expect(entities[0].id).toEqual(event.entity.id)
          expect(exposures.length).toEqual(1)
          expect(exposures[0].methodCalled).toEqual('getVariation')
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )

      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({entities: body.entities, exposures: body.exposures})
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: JS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        timestamp = Date.now()
        Flagger.getVariation('flagger', event.entity)
      })
    })
    it('ingestion data validation', done => {
      const trackCallback = jest.fn(data => {
        ingestionValidator(data)
        const errors = ajv.errorsText(ingestionValidator.errors)
        Flagger.shutdown().then(_ => {
          if (errors !== 'No errors') {
            done(errors)
          } else {
            done()
          }
        })
      })

      api.post(uri).reply(200, async (_, body: Body) => {
        trackCallback(body)
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        for (let i = 0; i < 100; i++) {
          // call every method for diversity of the ingestion request
          Flagger.isSampled('flagger', event.entity)
          Flagger.isEnabled('google', event.entity)
          Flagger.getPayload('bitcoin', event.entity)
          Flagger.getVariation('new_dashboard', event.entity)
          Flagger.track('test', {admin: true}, event.entity)
          Flagger.publish(event.entity)
        }
      })
    })
  })

  describe('Nodejs tests', () => {
    it('data is sent after SDK collected 500 api calls', done => {
      const trackCallback = jest.fn(
        ({
          entities,
          exposures
        }: {
          entities: IEntity[]
          exposures: IExposure[]
        }) => {
          expect(entities.length).toEqual(1)
          expect(entities[0].id).toEqual(event.entity.id)
          expect(exposures.length).toEqual(500)
          expect(exposures[0].methodCalled).toEqual('isEnabled')
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )

      api.post(uri).reply(200, (_, body: any) => {
        const {entities, exposures} = body
        trackCallback({entities, exposures})
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        for (let i = 0; i < 500; i++) {
          Flagger.isEnabled('flagger', event.entity)
        }
      })
    })

    it('Must return 25 distinct(de-duplicated) entities', done => {
      const trackCallback = jest.fn(
        ({
          entities,
          exposures
        }: {
          entities: IEntity[]
          exposures: IExposure[]
        }) => {
          expect(entities.length).toEqual(25)

          expect(exposures.length).toEqual(500)
          expect(exposures[0].methodCalled).toEqual('isEnabled')
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )

      api.post(uri).reply(200, (_, body: any) => {
        const {entities, exposures} = body
        trackCallback({entities, exposures})
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        const testEntitiesArray: string[] = []
        for (let i = 0; i < 25; i++) {
          testEntitiesArray.push(i.toString())
        }

        for (let i = 0; i < 20; i++) {
          testEntitiesArray.forEach(element => {
            Flagger.isEnabled('flagger', {id: element})
          })
        }
      })
    })

    it('Must return 20 distinct(de-duplicated) entities since last ingestion', done => {
      let callCounter = 0
      const trackCallback = jest.fn(
        ({
          entities,
          exposures
        }: {
          entities: IEntity[]
          exposures: IExposure[]
        }) => {
          callCounter++
          expect(exposures[0].methodCalled).toEqual('isEnabled')

          if (callCounter === 1) {
            expect(entities.length).toEqual(25)
            expect(exposures.length).toEqual(500)
          }

          if (callCounter === 2) {
            expect(entities.length).toEqual(20)
            expect(exposures.length).toEqual(500)
          }
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        const {entities, exposures} = body

        trackCallback({entities, exposures})
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        const testEntitiesArray: string[] = []
        for (let i = 0; i < 25; i++) {
          testEntitiesArray.push(i.toString())
        }

        /* FIRST INGESTION (25 ENTITIES)*/
        for (let i = 0; i < 20; i++) {
          testEntitiesArray.forEach(element => {
            Flagger.isEnabled('flagger', {id: element})
          })
        }

        /* SECOND INGESTION(20 ENTITIES) */
        for (let i = 0; i < 25; i++) {
          for (let j = 0; j < 20; j++) {
            Flagger.isEnabled('flagger', {id: testEntitiesArray[j]})
          }
        }
      })
    })

    it('data is sent after SDK collected 300 events and 200 flag calls', done => {
      const trackCallback = jest.fn(
        ({
          entities,
          exposures,
          events
        }: {
          entities: IEntity[]
          exposures: IExposure[]
          events: IEvent[]
        }) => {
          expect(entities.length).toEqual(1)

          expect(exposures.length).toEqual(200)
          expect(events.length).toEqual(300)
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        const {entities, exposures, events} = body

        trackCallback({
          entities,
          exposures,
          events
        })
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        for (let i = 0; i < 300; i++) {
          Flagger.track(event.name, event.properties, event.entity)
        }
        for (let i = 0; i < 200; i++) {
          Flagger.isEnabled('flagger', event.entity)
        }
      })
    })

    it('data is sent after SDK collected 100 events and 300 flag calls and 100 publish calls', done => {
      const trackCallback = jest.fn(
        ({
          entities,
          exposures,
          events
        }: {
          entities: IEntity[]
          exposures: IExposure[]
          events: IEvent[]
        }) => {
          expect(entities.length).toEqual(1)

          expect(exposures.length).toEqual(300)
          expect(events.length).toEqual(100)
          expect(entities.length).toEqual(1)
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        const {entities, exposures, events} = body

        trackCallback({
          entities,
          exposures,
          events
        })
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        for (let i = 0; i < 100; i++) {
          Flagger.track(event.name, event.properties, event.entity)
        }
        for (let i = 0; i < 300; i++) {
          Flagger.isEnabled('flagger', event.entity)
        }
        for (let i = 0; i < 100; i++) {
          Flagger.publish(event.entity)
        }
      })
    })

    it('MAX_CALLS is set to 100 => SDK must send data every 100 calls', done => {
      const ingester = new Ingester(
        {name: NODEJS_SDK_NAME, version},
        `${INGESTION_URL}${apiKey}`,
        axiosInstance
      )
      const trackCallback = jest.fn(
        ({entities, events}: {entities: IEntity[]; events: IEvent[]}) => {
          expect(entities.length).toEqual(1)
          expect(events.length).toEqual(100)
          ingester.sendIngestionNow().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        const {entities, events} = body

        trackCallback({
          entities,
          events
        })
      })

      ingester.setIngestionMaxCalls(100)

      for (let i = 0; i < 100; i++) {
        ingester.track(event)
      }
    })

    it('test exposure hashkey is absent', done => {
      const trackCallback = jest.fn(({exposures}: {exposures: IExposure[]}) => {
        for (const exposure of exposures) {
          expect(exposure.hashkey).toEqual(undefined)
        }
        Flagger.shutdown().then(_ => {
          done()
        })
      })

      api.post(uri).reply(200, (_, body: any) => {
        const {exposures} = body
        trackCallback({
          exposures
        })
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        for (let i = 0; i < 500; i++) {
          Flagger.isEnabled('flagger', event.entity)
        }
      })
    })
    it('ingestion data validation', done => {
      const trackCallback = jest.fn((data: any) => {
        ingestionValidator(data)
        const errors = ajv.errorsText(ingestionValidator.errors)

        Flagger.shutdown().then(_ => {
          if (errors !== 'No errors') {
            done(errors)
          } else {
            done()
          }
        })
      })
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        for (let i = 0; i < 500; i++) {
          Flagger.isEnabled('flagger', event.entity)
        }
      })
    })
    it('detected flags test', done => {
      const trackCallback = jest.fn(
        ({detectedFlags}: {detectedFlags: string[]}) => {
          expect(detectedFlags.length).toEqual(5)
          Flagger.shutdown().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        const {detectedFlags} = body
        trackCallback({
          detectedFlags
        })
      })
      Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      }).then(_ => {
        for (let i = 0; i < 100; i++) {
          Flagger.isEnabled('test-1', event.entity)
          Flagger.isSampled('test-2', event.entity)
          Flagger.getPayload('test-3', event.entity)
          Flagger.getVariation('test-4', event.entity)
          Flagger.isEnabled('test-5', event.entity)
        }
      })
    })

    it('Entity has changed, so ingestion must send latest version of Entity', done => {
      const ingester = new Ingester(
        {name: NODEJS_SDK_NAME, version},
        `${INGESTION_URL}${apiKey}`,
        axiosInstance
      )
      const trackCallback = jest.fn(
        ({entities, events}: {entities: IEntity[]; events: IEvent[]}) => {
          expect(entities.length).toEqual(1)
          expect(entities[0].attributes).not.toEqual(null)
          if (entities[0].attributes) {
            expect(entities[0].attributes.test).toEqual(true)
          }
          expect(entities[0].id).toEqual('1')
          expect(events.length).toEqual(2)
          ingester.sendIngestionNow().then(_ => {
            done()
          })
        }
      )
      api.post(uri).reply(200, (_, body: any) => {
        const {entities, events} = body

        trackCallback({entities, events})
      })

      ingester.setIngestionMaxCalls(2)

      ingester.track(event)
      const newEntityEvent = {
        name: 'test',
        properties: {
          plan: 'Bronze',
          referrer: 'www.Google.com',
          shirt_size: 'medium'
        },
        entity: {id: '1', type: 'Company', attributes: {test: true}},
        timestamp: new Date().toISOString()
      }
      ingester.track(newEntityEvent)
    })

    describe('shutdown() tests', () => {
      it('small payload(no encoding)', done => {
        const trackCallback = jest.fn(
          ({
            entities,
            detectedFlags
          }: {
            entities: IEntity[]
            detectedFlags: string[]
          }) => {
            expect(entities.length).toEqual(1)
            expect(entities[0].id).toEqual('1')
            expect(detectedFlags.length).toEqual(1)
            expect(detectedFlags[0]).toEqual('shutdown')
            Flagger.shutdown().then(_ => {
              done()
            })
          }
        )
        api.post(uri).reply(200, (_, body: any) => {
          const {entities, detectedFlags} = body
          trackCallback({entities, detectedFlags})
        })
        Flagger.init({
          apiKey,
          sdkInfo: {name: NODEJS_SDK_NAME, version},
          sseURL
        }).then(_ => {
          Flagger.isEnabled('shutdown', {id: '1'})
          return Flagger.shutdown()
        })
      })

      it('big payload with encoding', done => {
        const trackCallback = jest.fn(
          ({
            entities,
            detectedFlags
          }: {
            entities: IEntity[]
            detectedFlags: string[]
          }) => {
            expect(entities.length).toEqual(1)
            expect(entities[0].id).toEqual('1')
            expect(detectedFlags.length).toEqual(1)
            expect(detectedFlags[0]).toEqual('shutdown')
            Flagger.shutdown().then(_ => {
              done()
            })
          }
        )
        api.post(uri).reply(200, (_, body: any) => {
          const {entities, detectedFlags} = body

          trackCallback({entities, detectedFlags})
        })
        Flagger.init({
          apiKey,
          sdkInfo: {name: NODEJS_SDK_NAME, version},
          sseURL
        }).then(_ => {
          // accumulate enough data so that ingestion request is gzip'ed
          for (let i = 0; i < 100; i++) {
            Flagger.isEnabled('shutdown', {id: '1'})
          }
          return Flagger.shutdown()
        })
      })
    })
  })
})
