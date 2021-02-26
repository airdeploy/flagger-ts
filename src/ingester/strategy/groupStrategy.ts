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
const DEFAULT_INGESTION_MAX_CALLS = 500
const DEFAULT_INGESTION_INTERVAL = 60 * MILLISECONDS_IN_SECONDS
const TRIGGER_REASON = {
  MAX_CALL: '"Maximum calls have been reached"',
  DETECTED_FLAG: '"New flag has been detected"',
  FIRST_EXPOSURES: '"First 10 exposures are always ingested"',
  TIMER: '"Ingestion interval has run out"',
  EMPTY_INGESTION: '"Empty ingestion on start"',
  SHUTDOWN: '"Shutdown is called"'
}

/*****
 * GroupStrategy groups ingestion data to minimize outbound traffic
 *
 * By default it sends data whatever event happens first:
 * - 60 seconds have passed (ingestionInterval)
 * or
 * - amount of accumulated entities, events and exposures reached 500 (ingestionMaxCalls)
 *
 * After data is sent, both timer and counter reset.
 *
 * There are few cases when GroupStrategy can send data prematurely:
 * 1. start() sends empty ingestion to notify server about SDK being used
 *
 * 2. These events trigger GroupStrategy to send accumulated data and new data:
 * 2.1. when new flag is detected
 * 2.2. first 10 exposures are always sent
 * 2.3. shutdown() is called
 *
 */
export default class GroupStrategy implements IIngestionStrategy {
  private ingestionMaxCalls: number = DEFAULT_INGESTION_MAX_CALLS
  private ingestionIntervalInMilliseconds: number = DEFAULT_INGESTION_INTERVAL
  private readonly ingestionURL: string
  private readonly sdkInfo: ISDKInfo
  private readonly retryPolicy = new RetryPolicy<any>()
  private sendFirstExposuresThreshold: number
  private exposureCounter = 0
  private callCounter = 0
  private ingestionInterval: ReturnType<typeof setInterval>

  private entities: Map<string, IEntity> = new Map()
  private exposures: IExposure[] = []
  private events: IEvent[] = []
  private detectedFlags: Set<string> = new Set()
  private readonly sendDataFunction: (url: string, data: any) => Promise<any>
  private ingestionPromise?: Promise<void>
  private isInitIngestionSent = false

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

    this.ingestionInterval = setInterval(() => {
      this.sendData(TRIGGER_REASON.TIMER).catch(err => {
        logger.debug('Ingestion error: ', err)
      })
    }, this.ingestionIntervalInMilliseconds)
  }

  public ingest(data: IIngestionData): void {
    this.accumulateData(data)

    const shouldSend = this.shouldSendData(data)
    if (shouldSend.shouldSend) {
      this.sendData(shouldSend.reason).catch(err => {
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
    clearInterval(this.ingestionInterval)
    this.ingestionIntervalInMilliseconds = intervalInMilliseconds
    this.ingestionInterval = setInterval(() => {
      this.sendData(TRIGGER_REASON.TIMER).catch(err => {
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

  public start(): void {
    this.sendData(TRIGGER_REASON.EMPTY_INGESTION)
  }

  /****
   * Either wait for current ingestion to finish or send new ingestion data
   */
  public async shutdown() {
    clearInterval(this.ingestionInterval)
    if (!this.ingestionPromise && !this.isEmpty()) {
      return this.sendData(TRIGGER_REASON.SHUTDOWN)
    } else {
      return this.ingestionPromise
    }
  }

  public setSendFirstExposuresThreshold(threshold: number) {
    this.sendFirstExposuresThreshold = threshold
  }

  private async sendData(reason: string) {
    if (this.isEmpty()) {
      if (this.isInitIngestionSent) {
        return
      } else {
        this.isInitIngestionSent = true
      }
    }
    logger.debug(`${reason} triggers ingestion request`)

    const requestBody = {
      id: uuid.v4(),
      entities: Array.from(this.entities.values()) || [],
      exposures: this.exposures || [],
      events: this.events || [],
      sdkInfo: this.sdkInfo,
      detectedFlags: Array.from(this.detectedFlags.values()) || []
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

  private accumulateData(data: IIngestionData): void {
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
  }

  /**
   * Rules to send ingestion data:
   * - ingester is full
   * - flagger has detected the flag which is not in config
   * - first 10 exposures are always ingested
   */
  private shouldSendData(
    data: IIngestionData
  ): {shouldSend: boolean; reason: string} {
    if (this.callCounter >= this.ingestionMaxCalls) {
      return {shouldSend: true, reason: TRIGGER_REASON.MAX_CALL}
    }

    if (data.detectedFlag) {
      return {shouldSend: true, reason: TRIGGER_REASON.DETECTED_FLAG}
    }

    if (
      data.exposures &&
      data.exposures.length > 0 &&
      this.exposureCounter <= this.sendFirstExposuresThreshold
    ) {
      return {shouldSend: true, reason: TRIGGER_REASON.FIRST_EXPOSURES}
    }
    return {shouldSend: false, reason: ''}
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
