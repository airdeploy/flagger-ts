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
import {Logger} from './Logger/Logger'
import SSE from './sse'
import {
  escapeEntity,
  IAttributes,
  IEntity,
  IFlaggerConfiguration,
  ISDKInfo
} from './Types'

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

export class Flagger {
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
  public static async init({
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
    logLevel?: 'warn' | 'warning' | 'deb' | 'debug' | 'err' | 'error'
    sdkInfo?: ISDKInfo
  }) {
    if (!apiKey) {
      logger.error('No apiKey provided')
      throw new Error('No apiKey provided')
    }

    if (logLevel) {
      Logger.LOG_LEVEL = Logger.parseLevel(logLevel)
    }

    await this.shutdown()

    this.instance.updateFlaggerInstance(
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

    this.instance.ingester = new Ingester(
      localSDKInfo,
      this.instance.ingestionURL,
      axiosInstance
    )

    await Promise.resolve(
      axiosInstance.get(this.instance.sourceURL + this.instance.apiKey)
    )
      .then(({data: initConfig}: {data: IFlaggerConfiguration}) => {
        Flagger.updateConfig(initConfig)
        return this.instance
      })
      .catch(() =>
        Promise.resolve(
          axiosInstance.get(
            this.instance.backupSourceURL + this.instance.apiKey
          )
        )
          .then(({data: initConfig}: {data: IFlaggerConfiguration}) => {
            Flagger.updateConfig(initConfig)
            return this.instance
          })
          .catch(err => {
            throw err
          })
      )

    this.instance.sse = new SSE()
    this.instance.sse.init(
      (newConfigurationFromServer: IFlaggerConfiguration) => {
        Flagger.updateConfig(newConfigurationFromServer)
      },
      `${this.instance.sseURL}${this.instance.apiKey}`
    )
  }

  /*****
   * Add a listener to subscribe to event when Flagger gets new FlaggerConfiguration
   * @param listener
   */
  public static addFlaggerConfigUpdateListener(
    listener: (config: IFlaggerConfiguration) => void
  ): void {
    Flagger.instance.flaggerConfigListeners.push(listener)
  }

  /*****
   * Removes a listener
   * @param listener
   */
  public static removeFlaggerConfigUpdateListener(
    listener: (config: IFlaggerConfiguration) => void
  ): void {
    Flagger.instance.flaggerConfigListeners = Flagger.instance.flaggerConfigListeners.filter(
      l => l !== listener
    )
  }

  public static isConfigured(): boolean {
    return !!Flagger.instance.apiKey || !!Flagger.instance.flaggerConfiguration
  }

  /*****
   * Determines if flag is enabled for entity.
   * @param codename
   * @param entity
   */
  public static isEnabled(codename: string, entity?: IEntity): boolean {
    entity = escapeEntity(entity)
    const flagResult = this.instance.core.evaluateFlagProperties(
      codename,
      entity
    )
    logger.debug(JSON.stringify(flagResult))
    if (this.instance.ingester) {
      this.instance.ingester.ingestExposure(
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
  public static isSampled(codename: string, entity?: IEntity): boolean {
    entity = escapeEntity(entity)
    const flagResult = this.instance.core.evaluateFlagProperties(
      codename,
      entity
    )
    logger.debug(JSON.stringify(flagResult))
    if (this.instance.ingester) {
      this.instance.ingester.ingestExposure(
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
  public static getVariation(codename: string, entity?: IEntity): string {
    entity = escapeEntity(entity)
    const flagResult = this.instance.core.evaluateFlagProperties(
      codename,
      entity
    )
    logger.debug(JSON.stringify(flagResult))
    if (this.instance.ingester) {
      this.instance.ingester.ingestExposure(
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
  public static getPayload(codename: string, entity?: IEntity): {} {
    entity = escapeEntity(entity)
    const flagResult = this.instance.core.evaluateFlagProperties(
      codename,
      entity
    )
    logger.debug(JSON.stringify(flagResult))
    if (this.instance.ingester) {
      this.instance.ingester.ingestExposure(
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
  public static publish(entity: IEntity): void {
    const e = escapeEntity(entity)
    if (!e) {
      logger.warn('Could not publish because entity is empty')
      return
    }
    if (!entity.id) {
      logger.warn('Could not publish because entity.id is empty')
      return
    }
    if (this.instance.ingester) {
      this.instance.ingester.publish(e)
    }
  }

  /*****
   * Simple event tracking API. Entity is an optional parameter if it was set before.
   * @param name
   * @param properties
   * @param entity
   */
  public static track(
    name: string,
    properties: IAttributes,
    entity?: IEntity
  ): void {
    if (entity && !entity.id) {
      logger.warn('Could not track because entity.id is empty')
      return
    }
    entity = escapeEntity(entity)
    if (this.instance.ingester) {
      this.instance.ingester.track({
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
  public static setEntity(entity?: IEntity): void {
    if (entity && !entity.id) {
      logger.warn('Could not setEntity because id is empty, entity: ', entity)
      return
    }

    entity = escapeEntity(entity)
    this.instance.core.setEntity(entity)
    if (this.instance.ingester) {
      this.instance.ingester.setEntity(entity)
    }
  }

  /*****
   * shutdown ingests data(if any), stop ingester and closes SSE connection.
   */
  public static async shutdown() {
    if (this.instance.sse) {
      this.instance.sse.disconnect()
      this.instance.sse = null
    }
    if (this.instance.ingester) {
      const promise = this.instance.ingester.sendIngestionNow()
      this.instance.ingester = null
      return promise
    }
    return Promise.resolve()
  }

  private static instance: Flagger = new Flagger()

  private static updateConfig(config: IFlaggerConfiguration) {
    logger.debug('New FlaggerConfiguration: ', JSON.stringify(config))
    this.instance.flaggerConfiguration = config
    this.instance.core.setConfig(config)
    if (this.instance.ingester) {
      this.instance.ingester.setIngestionMaxCalls(
        config.sdkConfig.SDK_INGESTION_MAX_CALLS
      )
      this.instance.ingester.setIngestionInterval(
        config.sdkConfig.SDK_INGESTION_INTERVAL * 1000
      )
    }
    this.instance.flaggerConfigListeners.forEach(
      (listener: (config: IFlaggerConfiguration) => void) => {
        listener(config)
      }
    )
  }

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

  private constructor() {
    if (Flagger.instance) {
      throw new Error(
        'Instantiation failed: Use Flagger.init() instead of new.'
      )
    }
    Flagger.instance = this
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
      this.sourceURL = sourceURL
    }
    if (backupSourceURL) {
      this.backupSourceURL = backupSourceURL
    }
    if (sseURL) {
      this.sseURL = sseURL
    }
    if (ingestionURL) {
      this.ingestionURL = ingestionURL
    }
  }
}
