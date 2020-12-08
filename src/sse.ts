import eventsource from 'eventsource'
import {SSE_CONNECTION_URL} from './constants'
import {Logger} from './Logger/Logger'
import {IFlaggerConfiguration} from './Types'

const EventSource =
  typeof window === 'object' && window.EventSource
    ? window.EventSource
    : eventsource

const logger = new Logger('SSE')

const reconnectionUpperBound = 30 * 1000 // 30 seconds
const messageTimeout = 30 * 1000 // 30 seconds
const keepAliveCheckInterval = 2 * 1000 // 2 seconds

export default class SSE {
  private callback!: (flagConfig: IFlaggerConfiguration) => void
  private lastSSEMessageTS!: Date
  private sseConnectionURL = SSE_CONNECTION_URL
  private eventSource!: any
  private sseInterval!: ReturnType<typeof setInterval>
  private reconnectionTimeout!: ReturnType<typeof setTimeout>

  public init(
    callback: (flagConfig: IFlaggerConfiguration) => void,
    sseUrl: string
  ) {
    this.callback = callback
    this.sseConnectionURL = sseUrl
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
    }
  }

  private isConnectionExpired() {
    return (
      !this.lastSSEMessageTS ||
      new Date().getTime() - this.lastSSEMessageTS.getTime() > messageTimeout
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
        this.shutdown()
        const randomReconnectionInterval =
          Math.floor(Math.random() * reconnectionUpperBound) + 1
        logger.debug(
          `Connection is expired. Will reconnect in ${randomReconnectionInterval}ms`
        )
        this.reconnectionTimeout = setTimeout(() => {
          this.connect()
          this.setupConnectionRoutine()
        }, randomReconnectionInterval)
      }
    }, keepAliveCheckInterval)
  }
}
