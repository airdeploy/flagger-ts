import EventSource from 'eventsource'
import {SSE_CONNECTION_URL} from './constants'
import {Logger} from './Logger/Logger'
import {IFlaggerConfiguration} from './Types'

const logger = new Logger('SSE')

export default class SSE {
  private callback!: (flagConfig: IFlaggerConfiguration) => void
  private lastSSEConnect!: Date
  private sseConnectionURL = SSE_CONNECTION_URL
  private eventSource!: EventSource
  private sseInterval!: ReturnType<typeof setInterval>

  public init(
    callback: (flagConfig: IFlaggerConfiguration) => void,
    sseUrl: string
  ) {
    this.callback = callback
    this.sseConnectionURL = sseUrl
    logger.debug('SSE Connection URL: ', this.sseConnectionURL)
    this.connect()

    this.sseInterval = setInterval(() => {
      if (this.isConnectionExpired()) {
        logger.debug('Establishing SSE connection')
        this.connect()
      }
    }, 2000)
  }

  public disconnect() {
    clearInterval(this.sseInterval)
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource.removeEventListener('flagConfigUpdate')
      this.eventSource.removeEventListener('keepalive')
    }
  }

  private isConnectionExpired() {
    return (
      !this.lastSSEConnect ||
      new Date().getTime() - this.lastSSEConnect.getTime() > 30 * 1000
    )
  }

  private connect() {
    this.disconnect()
    this.eventSource = new EventSource(this.sseConnectionURL)
    this.eventSource.addEventListener('flagConfigUpdate', (evt: any) => {
      logger.debug('New FlaggerConfiguration from SSE: ', JSON.stringify(evt))
      this.updateLastSSEConnectionTime()
      this.callback(JSON.parse(evt.data))
    })

    this.eventSource.addEventListener('keepalive', (evt: any) => {
      logger.debug('Keepalive: ' + JSON.stringify(evt))
      this.updateLastSSEConnectionTime()
    })

    this.eventSource.onopen = () => {
      this.updateLastSSEConnectionTime()
    }
  }

  private updateLastSSEConnectionTime() {
    this.lastSSEConnect = new Date()
    logger.debug('Last message from SSE time: ', this.lastSSEConnect)
  }
}
