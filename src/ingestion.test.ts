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
import {waitTime} from './utils'

const ajv = new Ajv({allErrors: true})
const ingestionValidator = ajv.compile(ingestionSchema)
const CODENAME_FROM_CONFIG = FlaggerConfiguration.flags[0].codename
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
const sseURL = 'http://localhost/skip/'

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
        ingester.shutdown().then(_ => {
          done()
        })
      })
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({events: body.events})
      })

      ingester.track(event)
    })
    it('.publish() triggers SDK to send data immediately', async () => {
      const ingester = new Ingester(
        {name: JS_SDK_NAME, version},
        INGESTION_URL + apiKey,
        axiosInstance
      )

      const trackCallback = jest.fn()
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback({entities: body.entities})
      })

      ingester.publish(event.entity)

      await ingester.shutdown()

      expect(trackCallback).toBeCalled()
      expect(trackCallback)
      expect(trackCallback.mock.calls[0][0].entities.length).toEqual(1)
      expect(trackCallback.mock.calls[0][0].entities[0].id).toEqual(
        event.entity.id
      )
    })

    it(".publish() doesn't ingest for invalid entity", async () => {
      const trackCallback = jest.fn()
      api
        .post(uri)
        .optionally()
        .reply(200, (_, body: any) => {
          trackCallback({entities: body.entities})
        })

      await Flagger.init({
        apiKey,
        sdkInfo: {name: JS_SDK_NAME, version},
        sseURL
      })

      Flagger.publish(JSON.parse(JSON.stringify('')))
      Flagger.publish(JSON.parse(JSON.stringify({})))

      await Flagger.shutdown()

      api.done()
      nock.cleanAll()
      scope = nock(SOURCE_URL)
        .get('/' + apiKey)
        .reply(200, FlaggerConfiguration)
        .persist(true)
    })
    it('flag.isEnabled() triggers SDK to send data in ~250ms', done => {
      catchIngestion(1) // empty init
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
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      })
    })
    it('flag.isSampled() triggers SDK to send data in ~250ms', done => {
      catchIngestion(1) // empty init

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
        Flagger.isSampled(CODENAME_FROM_CONFIG, event.entity)
      })
    })
    it('flag.getPayload() triggers SDK to send data in ~250ms', done => {
      catchIngestion(1) // empty init

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
        Flagger.getPayload(CODENAME_FROM_CONFIG, event.entity)
      })
    })
    it('flag.getVariation() triggers SDK to send data in ~250ms', done => {
      catchIngestion(1) // empty init

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
        Flagger.getVariation(CODENAME_FROM_CONFIG, event.entity)
      })
    })

    it("track() doesn't ingest for invalid entity", async () => {
      const trackCallback = jest.fn()
      api
        .post(uri)
        .optionally()
        .reply(200, async (_, body: Body) => {
          trackCallback(body)
        })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: JS_SDK_NAME, version},
        sseURL
      })

      Flagger.track('test', {admin: true}, JSON.parse(JSON.stringify({})))
      Flagger.track('test', {admin: true}, JSON.parse(JSON.stringify('')))

      api.done()
      nock.cleanAll()
      scope = nock(SOURCE_URL)
        .get('/' + apiKey)
        .reply(200, FlaggerConfiguration)
        .persist(true)
    })
    it('ingestion data validation', async () => {
      const trackCallback = jest.fn()
      const toBeCalled = 3 // emtpy init + max call + timer runs out
      api
        .post(uri)
        .times(toBeCalled)
        .reply(200, async (_, body: Body) => {
          trackCallback(body)
        })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: JS_SDK_NAME, version},
        sseURL
      })

      for (let i = 0; i < 100; i++) {
        // call every method for diversity of the ingestion request
        Flagger.isSampled(CODENAME_FROM_CONFIG, event.entity)
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
        Flagger.getPayload(CODENAME_FROM_CONFIG, event.entity)
        Flagger.getVariation(CODENAME_FROM_CONFIG, event.entity)
        Flagger.track('test', {admin: true}, event.entity)
        Flagger.publish(event.entity)
      }
      await waitTime(400)

      expect(trackCallback).toBeCalledTimes(toBeCalled)

      await Flagger.shutdown() // doesn't trigger anything, ingester is empty

      expect(trackCallback).toBeCalledTimes(toBeCalled)

      ingestionValidator(trackCallback.mock.calls[0][0])
      const errors = ajv.errorsText(ingestionValidator.errors)
      expect(errors).toEqual('No errors')
    })
  })

  describe('Nodejs tests', () => {
    it('data is sent after SDK collected 500 api calls', async () => {
      const trackCallback = jest.fn()

      api
        .post(uri)
        .times(12)
        .reply(200, (_, body: any) => {
          const {entities, exposures} = body
          trackCallback({entities, exposures})
        })

      await Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })

      for (let i = 0; i < 510; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }

      await Flagger.shutdown()

      // 12 times:
      // - empty init
      // - first 10 exposures
      // - the rest 500 exposures
      expect(trackCallback).toBeCalledTimes(12)

      for (let i = 1; i < 11; i++) {
        expect(trackCallback.mock.calls[i][0].exposures.length).toEqual(1)
      }
      expect(trackCallback.mock.calls[11][0].exposures.length).toEqual(500)

      expect(trackCallback.mock.calls[11][0].entities.length).toEqual(1)
      expect(trackCallback.mock.calls[11][0].entities[0].id).toEqual(
        event.entity.id
      )
      expect(trackCallback.mock.calls[11][0].exposures[0].methodCalled).toEqual(
        'isEnabled'
      )
    })

    it('Must return 25 distinct(de-duplicated) entities', async () => {
      catchIngestion(11) // empty init + first 10 exposures

      const trackCallback = jest.fn()

      api.post(uri).reply(200, (_, body: any) => {
        const {entities, exposures} = body
        trackCallback({entities, exposures})
      })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })

      /* Skipping first 10 exposures */
      for (let i = 0; i < 10; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }

      const testEntitiesArray: string[] = []
      for (let i = 0; i < 25; i++) {
        testEntitiesArray.push(i.toString())
      }

      // 25 * 20 = 500
      for (let i = 0; i < 20; i++) {
        testEntitiesArray.forEach(element => {
          Flagger.isEnabled(CODENAME_FROM_CONFIG, {id: element})
        })
      }
      await Flagger.shutdown()

      expect(trackCallback).toBeCalledTimes(1)

      expect(trackCallback.mock.calls[0][0].entities.length).toEqual(25)
      expect(trackCallback.mock.calls[0][0].exposures.length).toEqual(500)
      expect(trackCallback.mock.calls[0][0].exposures[0].methodCalled).toEqual(
        'isEnabled'
      )
    })

    it('Must return 20 distinct(de-duplicated) entities since last ingestion', async () => {
      catchIngestion(11) // empty init + first 10 exposures

      const trackCallback = jest.fn()

      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })
      const testEntitiesArray: string[] = []
      for (let i = 0; i < 25; i++) {
        testEntitiesArray.push(i.toString())
      }

      /* Skipping first 10 exposures */
      for (let i = 0; i < 10; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }

      /* FIRST INGESTION (25 ENTITIES) */
      for (let i = 0; i < 20; i++) {
        testEntitiesArray.forEach(element => {
          Flagger.isEnabled(CODENAME_FROM_CONFIG, {id: element})
        })
      }

      /* SECOND INGESTION(20 ENTITIES) */
      for (let i = 0; i < 25; i++) {
        for (let j = 0; j < 20; j++) {
          Flagger.isEnabled(CODENAME_FROM_CONFIG, {id: testEntitiesArray[j]})
        }
      }

      await Flagger.shutdown()

      expect(trackCallback).toBeCalledTimes(2)

      /* FIRST */
      expect(trackCallback.mock.calls[0][0].exposures[0].methodCalled).toEqual(
        'isEnabled'
      )
      expect(trackCallback.mock.calls[0][0].entities.length).toEqual(25)
      expect(trackCallback.mock.calls[0][0].exposures.length).toEqual(500)

      /* SECOND */
      expect(trackCallback.mock.calls[1][0].exposures[0].methodCalled).toEqual(
        'isEnabled'
      )
      expect(trackCallback.mock.calls[1][0].entities.length).toEqual(20)
      expect(trackCallback.mock.calls[1][0].exposures.length).toEqual(500)
    })

    it('data is sent after SDK collected 300 events and 200 flag calls', async () => {
      catchIngestion(11) // empty init + first 10 exposures

      const trackCallback = jest.fn()
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })

      /* Skipping first 10 exposures */
      for (let i = 0; i < 10; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }

      for (let i = 0; i < 300; i++) {
        Flagger.track(event.name, event.properties, event.entity)
      }
      for (let i = 0; i < 200; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }

      await Flagger.shutdown()

      expect(trackCallback).toBeCalledTimes(1)

      expect(trackCallback.mock.calls[0][0].entities.length).toEqual(1)
      expect(trackCallback.mock.calls[0][0].exposures.length).toEqual(200)
      expect(trackCallback.mock.calls[0][0].events.length).toEqual(300)
    })

    it('data is sent after SDK collected 100 events and 300 flag calls and 100 publish calls', async () => {
      catchIngestion(11) // empty init + first 10 exposures

      const trackCallback = jest.fn()
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })
      await Flagger.init({
        apiKey,
        sourceURL: SOURCE_URL,
        ingestionURL: INGESTION_URL,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })

      /* Skipping first 10 exposures */
      for (let i = 0; i < 10; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }

      for (let i = 0; i < 100; i++) {
        Flagger.track(event.name, event.properties, event.entity)
      }
      for (let i = 0; i < 300; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }
      for (let i = 0; i < 100; i++) {
        Flagger.publish(event.entity)
      }

      await Flagger.shutdown()

      expect(trackCallback).toBeCalledTimes(1)

      /* 12-th call */
      expect(trackCallback.mock.calls[0][0].entities.length).toEqual(1)
      expect(trackCallback.mock.calls[0][0].exposures.length).toEqual(300)
      expect(trackCallback.mock.calls[0][0].events.length).toEqual(100)
    })
    it('should send data every 100 calls', async () => {
      const ingester = new Ingester(
        {name: NODEJS_SDK_NAME, version},
        `${INGESTION_URL}${apiKey}`,
        axiosInstance,
        0
      )
      const trackCallback = jest.fn()

      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })

      ingester.setIngestionMaxCalls(100)

      for (let i = 0; i < 100; i++) {
        ingester.track(event)
      }

      await ingester.shutdown()

      expect(trackCallback).toBeCalledTimes(1)
      expect(trackCallback.mock.calls[0][0].entities.length).toEqual(1)
      expect(trackCallback.mock.calls[0][0].events.length).toEqual(100)
    })

    it('test exposure hashkey is absent', async () => {
      catchIngestion(1) // empty init

      const trackCallback = jest.fn()

      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })
      Flagger.isEnabled('flagger', event.entity)

      await Flagger.shutdown()
      expect(trackCallback).toBeCalledTimes(1)
      expect(trackCallback.mock.calls[0][0].exposures[0].hashKey).toEqual(
        undefined
      )
    })

    it('ingestion data validation', async () => {
      catchIngestion(1) // empty init

      const trackCallback = jest.fn()
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })
      Flagger.isEnabled('flagger', event.entity)
      await Flagger.shutdown()

      expect(trackCallback).toBeCalledTimes(1)

      ingestionValidator(trackCallback.mock.calls[0][0])
      const errors = ajv.errorsText(ingestionValidator.errors)
      expect(errors).toEqual('No errors')
    })

    it('detected flags test', async () => {
      catchIngestion(11) // empty init + first 10 exposures

      const trackCallback = jest.fn()
      api.post(uri).reply(200, (_, body: any) => {
        trackCallback(body)
      })
      await Flagger.init({
        apiKey,
        sdkInfo: {name: NODEJS_SDK_NAME, version},
        sseURL
      })

      /* Skipping first 10 exposures */
      for (let i = 0; i < 10; i++) {
        Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
      }

      Flagger.getVariation('test-1', event.entity)
      Flagger.isSampled('test-2', event.entity)
      Flagger.getPayload('test-3', event.entity)
      Flagger.getVariation('test-4', event.entity)
      Flagger.isEnabled('test-5', event.entity)

      await Flagger.shutdown()

      expect(trackCallback).toBeCalledTimes(5)

      expect(trackCallback.mock.calls[0][0].exposures[0].codename).toEqual(
        'test-1'
      )
      expect(trackCallback.mock.calls[0][0].exposures[0].methodCalled).toEqual(
        'getVariation'
      )

      expect(trackCallback.mock.calls[4][0].exposures[0].methodCalled).toEqual(
        'isEnabled'
      )
      expect(trackCallback.mock.calls[4][0].exposures[0].codename).toEqual(
        'test-5'
      )
    })

    it('Entity has changed, so ingestion must send latest version of Entity', done => {
      const ingester = new Ingester(
        {name: NODEJS_SDK_NAME, version},
        `${INGESTION_URL}${apiKey}`,
        axiosInstance,
        0
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
          ingester.shutdown().then(_ => {
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
      it('small payload(no encoding)', async () => {
        catchIngestion(1) // empty init

        const codename = 'new-signup-flow'
        const trackCallback = jest.fn()
        api.post(uri).reply(200, (_, body: any) => {
          const {entities, detectedFlags} = body
          trackCallback({entities, detectedFlags})
        })
        await Flagger.init({
          apiKey,
          sdkInfo: {name: NODEJS_SDK_NAME, version},
          sseURL
        })
        Flagger.isEnabled(codename, {id: '1'})

        await Flagger.shutdown()

        expect(trackCallback).toBeCalledTimes(1)
        expect(trackCallback.mock.calls[0][0].entities.length).toEqual(1)
        expect(trackCallback.mock.calls[0][0].entities[0].id).toEqual('1')
      })

      it('big payload with encoding', async () => {
        catchIngestion(11) // empty init + first 10 exposures

        const trackCallback = jest.fn()
        api
          .post(uri)
          .times(11)
          .reply(200, (_, body: any) => {
            trackCallback(body)
          })
        await Flagger.init({
          apiKey,
          sdkInfo: {name: NODEJS_SDK_NAME, version},
          sseURL
        })

        /* Skipping first 10 exposures */
        for (let i = 0; i < 10; i++) {
          Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
        }

        await waitTime(3000)

        // accumulate enough data so that ingestion request is gzip'ed
        for (let i = 0; i < 100; i++) {
          Flagger.isEnabled(CODENAME_FROM_CONFIG, event.entity)
        }

        await Flagger.shutdown()

        expect(trackCallback).toBeCalledTimes(1)
        expect(trackCallback.mock.calls[0][0].entities.length).toEqual(1)
        expect(trackCallback.mock.calls[0][0].entities[0].id).toEqual('1')
      })
    })
  })
})

const catchIngestion = (times: number) => {
  api
    .post(uri)
    .times(times)
    .reply(200)
}
