import {Logger} from '../Logger/Logger'

const defaultMaxMemorySize = 2e8 // 100 MB

const logger = new Logger('RetryPolicy')

export default class RetryPolicy<T> {
  private static size(data: object): number {
    return JSON.stringify(data).length
  }
  private maxMemorySizeInBytes: number
  private readonly queue: object[]
  private currentMemorySize: number
  private ingestionURL!: string
  private httpCallback!: (url: string, data: any) => Promise<T>

  constructor() {
    this.maxMemorySizeInBytes = defaultMaxMemorySize
    this.queue = []
    this.currentMemorySize = 0
  }

  public async sendData(
    url: string,
    data: any,
    httpCallback: (url: string, data: any) => Promise<T>
  ) {
    this.ingestionURL = url
    this.httpCallback = httpCallback
    try {
      await httpCallback(url, data)
      logger.debug('ingestion url, data: ', url, JSON.stringify(data))
      await this.releaseWait()
    } catch (err) {
      logger.debug(err)
      this.putToQueue(data)
    }
  }

  public setMaxSize(maxMemorySize: number) {
    this.maxMemorySizeInBytes = maxMemorySize
  }

  private putToQueue(data: any) {
    if (
      this.currentMemorySize + RetryPolicy.size(data) <
      this.maxMemorySizeInBytes
    ) {
      this.addToQueue(data)
    } else {
      // removes first element from queue until there is enough space to add new data chunk
      while (true) {
        if (
          this.currentMemorySize + RetryPolicy.size(data) <
          this.maxMemorySizeInBytes
        ) {
          this.addToQueue(data)
          break
        }
        const first = this.queue.shift()
        if (!first) {
          return
        }
        this.currentMemorySize -= RetryPolicy.size(first)
      }
    }
  }

  private async releaseWait() {
    while (true) {
      // stop if queue is empty
      if (this.queue.length === 0) {
        return
      }
      const data = this.queue[0]

      try {
        logger.debug('Ingestion data: ', JSON.stringify(data))
        await this.httpCallback(this.ingestionURL, data)
        const first = this.queue.shift()
        if (first) {
          this.currentMemorySize -= RetryPolicy.size(first)
        }
      } catch {
        return
      }
    }
  }

  private addToQueue(data: object) {
    this.queue.push(data)
    this.currentMemorySize += RetryPolicy.size(data)
  }
}
