import uuid from 'uuid'
import {Logger} from '../../Logger/Logger'
import {IEntity, ISDKInfo} from '../../Types'
import {
  IEvent,
  IExposure,
  IIngestionData,
  IIngestionStrategy
} from '../Interfaces'
import RetryPolicy from '../RetryPolicy'

const logger = new Logger('GroupStrategy')

const MILLISECONDS_IN_SECONDS = 1000
export default class GroupStrategy implements IIngestionStrategy {
  private ingestionMaxCalls: number = 500
  private ingestionIntervalInMilliseconds: number = 60 * MILLISECONDS_IN_SECONDS
  private readonly ingestionURL: string
  private readonly sdkInfo: ISDKInfo
  private readonly retryPolicy = new RetryPolicy<any>()
  private sendFirstExposuresThreshold: number
  private exposureCounter = 0
  private callCounter = 0
  private ingestionTimer: ReturnType<typeof setTimeout>

  private entities: Map<string, IEntity> = new Map()
  private exposures: IExposure[] = []
  private events: IEvent[] = []
  private detectedFlags: Set<string> = new Set()
  private readonly sendDataFunction: (url: string, data: any) => Promise<any>
  private ingestionPromise?: Promise<void>

  constructor({
    ingestionURL,
    ingestionMaxCalls,
    ingestionIntervalInMilliseconds,
    sdkInfo,
    sendDataFunction,
    sendFirstExposuresThreshold = 10
  }: {
    ingestionURL: string
    retries?: number
    ingestionMaxCalls?: number
    ingestionIntervalInMilliseconds?: number
    sdkInfo: ISDKInfo
    sendDataFunction: (url: string, data: any) => Promise<any>
    sendFirstExposuresThreshold?: number
  }) {
    this.ingestionURL = ingestionURL
    this.sdkInfo = sdkInfo
    this.sendDataFunction = sendDataFunction
    this.sendFirstExposuresThreshold = sendFirstExposuresThreshold

    if (ingestionMaxCalls) {
      this.ingestionMaxCalls = ingestionMaxCalls
    }
    if (ingestionIntervalInMilliseconds) {
      this.ingestionIntervalInMilliseconds = ingestionIntervalInMilliseconds
    }

    this.ingestionTimer = setInterval(() => {
      this.sendData().catch(err => {
        logger.debug('Ingestion error: ', err)
      })
    }, this.ingestionIntervalInMilliseconds)
  }

  public ingest(data: IIngestionData): void {
    if (data.entities) {
      data.entities.forEach((entity: IEntity) => {
        this.entities.set(entity.id + entity.type, entity)
      })
    }

    if (data.events) {
      data.events.forEach((event: IEvent) => {
        this.events.push(event)
      })
    }

    if (data.exposures) {
      data.exposures.forEach((exposure: IExposure) => {
        this.exposures.push(exposure)
        if (this.exposureCounter <= this.sendFirstExposuresThreshold) {
          this.exposureCounter++
        }
      })
    }

    if (data.detectedFlag) {
      this.detectedFlags.add(data.detectedFlag)
    }

    this.callCounter++

    if (this.shouldSendData(data)) {
      this.sendData().catch(err => {
        logger.warn('Ingestion error: ', err)
      })

      // resetIngestion interval
      this.setIngestionInterval(this.ingestionIntervalInMilliseconds)
    }
  }

  public setIngestionMaxCall(ingestionMaxCalls: number) {
    this.ingestionMaxCalls = ingestionMaxCalls
  }

  public setIngestionInterval(intervalInMilliseconds: number) {
    clearInterval(this.ingestionTimer)
    this.ingestionIntervalInMilliseconds = intervalInMilliseconds
    this.ingestionTimer = setInterval(() => {
      this.sendData().catch(err => {
        logger.debug('Ingestion error: ', err)
      })
    }, this.ingestionIntervalInMilliseconds)
  }

  public clear() {
    this.entities = new Map()
    this.exposures = []
    this.events = []
    this.callCounter = 0
    this.detectedFlags = new Set()
  }

  /****
   * Either wait for current ingestion to finish or send new ingestion data
   */
  public async sendIngestionNow() {
    clearInterval(this.ingestionTimer)
    if (!this.ingestionPromise) {
      return this.sendData()
    } else {
      return this.ingestionPromise
    }
  }

  public setSendFirstExposuresThreshold(threshold: number) {
    this.sendFirstExposuresThreshold = threshold
  }

  private async sendData() {
    // do not sent empty ingestion requests
    if (this.isEmpty()) {
      this.clear()
      return
    }

    const requestBody = {
      id: uuid.v4(),
      entities: Array.from(this.entities.values()),
      exposures: this.exposures,
      events: this.events,
      sdkInfo: this.sdkInfo,
      detectedFlags: Array.from(this.detectedFlags.values())
    }
    this.clear()
    this.ingestionPromise = this.retryPolicy.sendData(
      this.ingestionURL,
      requestBody,
      this.sendDataFunction
    )

    // save ingestion request for the possible usage of sendIngestionNow
    this.ingestionPromise.then(_ => {
      this.ingestionPromise = undefined
    })

    return this.ingestionPromise
  }

  /**
   * Rules to send ingestion data:
   * - ingester is full
   * - flagger has detected a flag which is not in config
   * - first 10 exposures are always ingested
   */
  private shouldSendData(data: IIngestionData) {
    return (
      this.callCounter >= this.ingestionMaxCalls ||
      data.detectedFlag ||
      (data.exposures &&
        data.exposures.length > 0 &&
        this.exposureCounter <= this.sendFirstExposuresThreshold)
    )
  }

  private isEmpty(): boolean {
    return (
      this.entities.size === 0 &&
      this.detectedFlags.size === 0 &&
      this.events.length === 0 &&
      this.exposures.length === 0
    )
  }
}
