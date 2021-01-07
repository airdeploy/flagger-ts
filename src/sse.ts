import eventsource from 'eventsource'
import {SSE_CONNECTION_URL} from './constants'
import {Logger} from './Logger/Logger'
import {IFlaggerConfiguration} from './Types'
import {getRandomInRange} from './utils'

const EventSource =
  typeof window === 'object' && window.EventSource
    ? window.EventSource
    : eventsource

const logger = new Logger('SSE')

const RECON_UPPER_LIMIT = 30 * 1000 // 30 seconds
const MESSAGE_TIMEOUT = 28 * 1000 // 28 seconds + interval(2 seconds by default)
const TWO_SECONDS = 2 * 1000 // 2 seconds
const ONE_MINUTE = 60 * 1000

/*****
 * Establishes and maintains the connection for the Server Side Events.
 *
 * Requirements:
 * - Server must send SSE every "messageTimeout" ms.
 * - New connections must reconnect with a random delay.

 * SSE fulfills first requirement by running a check routine every
 * "keepAliveCheckInterval".
 *
 */
export default class SSE {
  private callback!: (flagConfig: IFlaggerConfiguration) => void
  private lastSSEMessageTS!: Date
  private sseConnectionURL = SSE_CONNECTION_URL
  private eventSource: any
  private sseInterval!: ReturnType<typeof setInterval>
  private reconnectionTimeout!: ReturnType<typeof setTimeout>
  private connectedAt?: Date
  private messageTimeout: number = MESSAGE_TIMEOUT
  private reconnectionUpperLimit: number = RECON_UPPER_LIMIT
  private keepAliveCheckInterval: number = TWO_SECONDS
  private addDelayBefore: number = ONE_MINUTE

  public init({
    callback,
    sseUrl,
    messageTimeout = MESSAGE_TIMEOUT,
    reconnectionUpperLimit = RECON_UPPER_LIMIT,
    keepAliveCheckInterval = TWO_SECONDS,
    addDelayBefore = ONE_MINUTE
  }: {
    callback: (flagConfig: IFlaggerConfiguration) => void
    sseUrl: string
    messageTimeout?: number
    reconnectionUpperLimit?: number
    keepAliveCheckInterval?: number
    addDelayBefore?: number
  }) {
    this.callback = callback
    this.sseConnectionURL = sseUrl
    this.messageTimeout = messageTimeout
    this.reconnectionUpperLimit = reconnectionUpperLimit
    this.keepAliveCheckInterval = keepAliveCheckInterval
    this.addDelayBefore = addDelayBefore
    logger.debug('SSE Connection URL: ', this.sseConnectionURL)
    this.connect()
    this.setupConnectionRoutine()
  }

  public shutdown() {
    clearInterval(this.sseInterval)
    clearTimeout(this.reconnectionTimeout)
    this.disconnect()
  }

  private disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      delete this.eventSource
      delete this.connectedAt
    }
  }

  private isConnectionExpired() {
    return (
      !this.lastSSEMessageTS ||
      new Date().getTime() - this.lastSSEMessageTS.getTime() >
        this.messageTimeout
    )
  }

  private connect() {
    this.eventSource = new EventSource(this.sseConnectionURL)
    this.eventSource.addEventListener('flagConfigUpdate', (evt: any) => {
      this.updateLastSSEConnectionTime()
      this.callback(JSON.parse(evt.data))
    })

    this.eventSource.addEventListener('keepalive', () => {
      this.updateLastSSEConnectionTime()
    })

    this.eventSource.onopen = () => {
      this.connectedAt = new Date()
      this.updateLastSSEConnectionTime()
    }

    this.eventSource.onerror = (evt: any) => {
      logger.debug('Error:', evt)
      this.disconnect()
    }
  }

  private updateLastSSEConnectionTime() {
    this.lastSSEMessageTS = new Date()
  }

  /**
   * Every keepAliveCheckInterval seconds checks if sse gets a message
   * When messageTimeout expires disconnects and schedules a new connection
   */
  private setupConnectionRoutine() {
    this.sseInterval = setInterval(() => {
      if (this.isConnectionExpired()) {
        const randomReconnectionInterval = this.isExceedsLengthLimit()
          ? 0
          : getRandomInRange(this.reconnectionUpperLimit)
        this.shutdown()
        logger.debug(
          `Connection is expired. Will reconnect in ${randomReconnectionInterval}ms`
        )
        this.reconnectionTimeout = setTimeout(() => {
          this.connect()
          this.setupConnectionRoutine()
        }, randomReconnectionInterval)
      }
    }, this.keepAliveCheckInterval)
  }

  private isExceedsLengthLimit() {
    return (
      this.connectedAt &&
      new Date().getTime() - this.connectedAt.getTime() > this.addDelayBefore
    )
  }
}
