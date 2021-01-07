import axios, {AxiosTransformer} from 'axios'
import axiosRetry from 'axios-retry'
import pako from 'pako'

import {
  BACKUP_SOURCE_URL,
  DEFAULT_NUMBER_OF_RETRIES,
  INGESTION_URL,
  SOURCE_URL,
  SSE_CONNECTION_URL
} from './constants'
import {Core} from './Core'
import Ingester from './ingester/Ingester'
import {Logger, LogLevel, LogLevelStrings} from './Logger/Logger'
import SSE from './sse'
import {
  escapeEntity,
  IAttributes,
  IEntity,
  IFlaggerConfiguration,
  ISDKInfo
} from './Types'
import {deepEqual} from './utils'

// __SDK_NAME__ is overwritten during compile time to either nodejs or js
const SDK_INFO = {name: '__SDK_NAME__', version: '__VERSION__'}

let transformRequest: AxiosTransformer[] = []
if (Array.isArray(axios.defaults.transformRequest)) {
  transformRequest = axios.defaults.transformRequest
}

export const axiosInstance = axios.create({
  transformRequest: [
    (data, headers) => {
      if (typeof data === 'object') {
        const stringData = JSON.stringify(data)
        if (stringData.length > 1024) {
          headers['Content-Encoding'] = 'gzip'
          headers['Content-Type'] = 'application/json;charset=utf-8'

          return pako.gzip(stringData)
        }
      }

      return data
    },
    ...transformRequest
  ]
})

axiosRetry(axiosInstance, {retries: DEFAULT_NUMBER_OF_RETRIES})

const logger = new Logger('Flagger')

export class FlaggerClass {
  private flaggerConfiguration!: IFlaggerConfiguration
  private sourceURL: string = SOURCE_URL
  private backupSourceURL: string = BACKUP_SOURCE_URL
  private sseURL: string = SSE_CONNECTION_URL
  private ingestionURL: string = INGESTION_URL
  private core: Core = new Core()
  private sse!: SSE | null
  private ingester!: Ingester | null
  private apiKey!: string
  private flaggerConfigListeners: Array<
    (config: IFlaggerConfiguration) => void
  > = []
  /*****
   * init method gets FlaggerConfiguration, establishes and maintains SSE
   * connections and initializes Ingester
   * @param apiKey - API key to an environment
   * @param sourceURL - URL to get FlaggerConfiguration
   * @param backupSourceURL - backup URL to get FlaggerConfiguration
   * @param sseURL - URL for real-time updates of FlaggerConfiguration via sse
   * @param ingestionURL - URL for ingestion
   * @param logLevel - log level: ERROR, WARN, DEBUG. Debug is the most verbose
   * level and includes all network requests
   * @param sdkInfo - for test purposes
   */
  public async init({
    apiKey,
    sourceURL,
    backupSourceURL,
    sseURL,
    ingestionURL,
    logLevel,
    sdkInfo
  }: {
    apiKey: string
    sourceURL?: string
    backupSourceURL?: string
    sseURL?: string
    ingestionURL?: string
    logLevel?: LogLevelStrings | LogLevel
    sdkInfo?: ISDKInfo
  }) {
    if (!apiKey) {
      logger.error('No apiKey provided')
      throw new Error('No apiKey provided')
    }

    if (logLevel) {
      if (typeof logLevel === 'string') {
        Logger.LOG_LEVEL = Logger.parseLevel(logLevel)
      } else {
        Logger.LOG_LEVEL = logLevel
      }
    }

    await this.shutdown()

    this.updateFlaggerInstance(
      apiKey,
      sourceURL,
      backupSourceURL,
      sseURL,
      ingestionURL
    )

    const localSDKInfo = sdkInfo ? sdkInfo : SDK_INFO

    if (localSDKInfo.name === 'nodejs') {
      // send Accept-Encoding header only for nodejs
      // browsers add this header by default
      // browsers consider Accept-Encoding unsafe and doesn't allow to modify it
      axiosInstance.defaults.headers.get = {'Accept-Encoding': 'gzip, deflate'}
    }

    this.ingester = new Ingester(localSDKInfo, this.ingestionURL, axiosInstance)
    this.ingester.start()

    await Promise.resolve(axiosInstance.get(this.sourceURL))
      .then(({data: initConfig}: {data: IFlaggerConfiguration}) => {
        this.updateConfig(initConfig)
        return this
      })
      .catch(() =>
        Promise.resolve(axiosInstance.get(this.backupSourceURL))
          .then(({data: initConfig}: {data: IFlaggerConfiguration}) => {
            this.updateConfig(initConfig)
            return this
          })
          .catch(err => {
            throw err
          })
      )

    this.sse = new SSE()
    this.sse.init({
      callback: (newConfigurationFromServer: IFlaggerConfiguration) => {
        this.updateConfig(newConfigurationFromServer)
      },
      sseUrl: this.sseURL
    })
  }

  /*****
   * Add a listener to subscribe to event when Flagger gets new FlaggerConfiguration
   * @param listener
   */
  public addFlaggerConfigUpdateListener(
    listener: (config: IFlaggerConfiguration) => void
  ): void {
    this.flaggerConfigListeners.push(listener)
  }

  /*****
   * Removes a listener
   * @param listener
   */
  public removeFlaggerConfigUpdateListener(
    listener: (config: IFlaggerConfiguration) => void
  ): void {
    this.flaggerConfigListeners = this.flaggerConfigListeners.filter(
      (l: any) => l !== listener
    )
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey) && Boolean(this.flaggerConfiguration)
  }

  /*****
   * Determines if flag is enabled for entity.
   * @param codename
   * @param entity
   */
  public isEnabled(codename: string, entity?: IEntity): boolean {
    entity = escapeEntity(entity)
    const flagResult = this.core.evaluateFlagProperties(codename, entity)
    logger.debug(JSON.stringify(flagResult))
    if (this.ingester) {
      this.ingester.ingestExposure(
        'isEnabled',
        codename,
        flagResult.variation.codename,
        flagResult.newFlag,
        flagResult.reason,
        flagResult.entity,
        flagResult.hashkey
      )
    }
    return flagResult.isEnabled
  }

  /*****
   * Determines if entity is within the targeted subpopulations
   * @param codename
   * @param entity
   */
  public isSampled(codename: string, entity?: IEntity): boolean {
    entity = escapeEntity(entity)
    const flagResult = this.core.evaluateFlagProperties(codename, entity)
    logger.debug(JSON.stringify(flagResult))
    if (this.ingester) {
      this.ingester.ingestExposure(
        'isSampled',
        codename,
        flagResult.variation.codename,
        flagResult.newFlag,
        flagResult.reason,
        flagResult.entity,
        flagResult.hashkey
      )
    }
    return flagResult.isSampled
  }

  /*****
   * Returns the variation assigned to the entity in a multivariate flag
   * @param codename
   * @param entity
   */
  public getVariation(codename: string, entity?: IEntity): string {
    entity = escapeEntity(entity)
    const flagResult = this.core.evaluateFlagProperties(codename, entity)
    logger.debug(JSON.stringify(flagResult))
    if (this.ingester) {
      this.ingester.ingestExposure(
        'getVariation',
        codename,
        flagResult.variation.codename,
        flagResult.newFlag,
        flagResult.reason,
        flagResult.entity,
        flagResult.hashkey
      )
    }
    return flagResult.variation.codename
  }

  /*****
   * Returns the payload associated with the treatment assigned to the entity
   * @param codename
   * @param entity
   */
  public getPayload(codename: string, entity?: IEntity): {} {
    entity = escapeEntity(entity)
    const flagResult = this.core.evaluateFlagProperties(codename, entity)
    logger.debug(JSON.stringify(flagResult))
    if (this.ingester) {
      this.ingester.ingestExposure(
        'getPayload',
        codename,
        flagResult.variation.codename,
        flagResult.newFlag,
        flagResult.reason,
        flagResult.entity,
        flagResult.hashkey
      )
    }
    return flagResult.payload
  }

  /*****
   * Explicitly notify server about an Entity
   * @param entity
   */
  public publish(entity: IEntity): void {
    const e = escapeEntity(entity)
    if (!e) {
      logger.warn('Could not publish because entity is empty')
      return
    }
    if (!entity.id) {
      logger.warn('Could not publish because entity.id is empty')
      return
    }
    if (this.ingester) {
      this.ingester.publish(e)
    }
  }

  /*****
   * Simple event tracking API. Entity is an optional parameter if it was set before.
   * @param name
   * @param properties
   * @param entity
   */
  public track(name: string, properties: IAttributes, entity?: IEntity): void {
    if (entity && !entity.id) {
      logger.warn('Could not track because entity.id is empty')
      return
    }
    entity = escapeEntity(entity)
    if (this.ingester) {
      this.ingester.track({
        name,
        properties,
        entity,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * set entity for the whole flagger SDK, so that one could omit
   * passing entity in isEnabled, isSampled, getVariation and getPayload methods
   * send null to reset Flagger to default Entity-state
   * @param entity
   */
  public setEntity(entity?: IEntity): void {
    if (entity && !entity.id) {
      logger.warn('Could not setEntity because id is empty, entity: ', entity)
      return
    }

    entity = escapeEntity(entity)
    this.core.setEntity(entity)
    if (this.ingester) {
      this.ingester.setEntity(entity)
    }
  }

  /*****
   * shutdown ingests data(if any), stop ingester and closes SSE connection.
   */
  public async shutdown() {
    let promise = Promise.resolve()
    if (this.sse) {
      this.sse.shutdown()
      this.sse = null
    }

    if (this.ingester) {
      promise = this.ingester.shutdown()
      this.ingester = null
    }
    delete this.flaggerConfiguration
    delete this.apiKey
    return promise
  }

  private updateConfig(config: IFlaggerConfiguration) {
    logger.debug('New FlaggerConfiguration: ', JSON.stringify(config))
    const shouldUpdate =
      !this.flaggerConfiguration ||
      !deepEqual(this.flaggerConfiguration, config)
    if (shouldUpdate) {
      this.flaggerConfiguration = config
      this.core.setConfig(config)
      if (this.ingester) {
        this.ingester.setIngestionMaxCalls(
          config.sdkConfig.SDK_INGESTION_MAX_CALLS
        )
        this.ingester.setIngestionInterval(
          config.sdkConfig.SDK_INGESTION_INTERVAL * 1000
        )
      }
      this.flaggerConfigListeners.forEach(
        (listener: (config: IFlaggerConfiguration) => void) => {
          listener(config)
        }
      )
    }
  }

  private updateFlaggerInstance(
    apiKey: string,
    sourceURL?: string,
    backupSourceURL?: string,
    sseURL?: string,
    ingestionURL?: string
  ) {
    this.apiKey = apiKey

    if (sourceURL) {
      this.sourceURL = `${sourceURL}${this.apiKey}`
    } else {
      this.sourceURL = `${SOURCE_URL}${this.apiKey}`
    }

    if (backupSourceURL) {
      this.backupSourceURL = `${backupSourceURL}${this.apiKey}`
    } else {
      this.backupSourceURL = `${BACKUP_SOURCE_URL}${this.apiKey}`
    }

    if (sseURL) {
      this.sseURL = `${sseURL}${this.apiKey}`
    } else {
      this.sseURL = `${SSE_CONNECTION_URL}${this.apiKey}`
    }
    if (ingestionURL) {
      this.ingestionURL = `${ingestionURL}${this.apiKey}`
    } else {
      this.ingestionURL = `${INGESTION_URL}${this.apiKey}`
    }
  }
}

export const flagger = new FlaggerClass()
