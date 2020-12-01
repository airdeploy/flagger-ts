import {AxiosInstance} from 'axios'
import {INGESTION_URL} from '../constants'
import {Reason} from '../Core'
import {Logger} from '../Logger/Logger'
import {IEntity, ISDKInfo} from '../Types'
import {IEvent, IIngestionData, IIngestionStrategy} from './Interfaces'
import GroupStrategy from './strategy/groupStrategy'

const logger = new Logger('Ingester')

export interface IIngestionInterface extends IIngestionStrategy {
  publish(entity: IEntity, callback?: (error: Error) => void): void

  track(event: IEvent, callback?: (error: Error) => void): void
}

export default class Ingester implements IIngestionInterface {
  private readonly ingestionURL: string = INGESTION_URL
  private readonly sdkInfo: ISDKInfo
  private entity?: IEntity
  private readonly ingestionStrategy: GroupStrategy

  constructor(
    sdkInfo: ISDKInfo,
    ingestionURL: string,
    axiosInstance: AxiosInstance,
    sendFirstExposuresThreshold: number = 10
  ) {
    this.sdkInfo = sdkInfo
    this.ingestionURL = ingestionURL

    logger.debug('ingestionURL:', ingestionURL)

    this.ingestionStrategy = new GroupStrategy({
      ingestionURL: this.ingestionURL,
      sdkInfo,
      sendDataFunction: axiosInstance.post,
      sendFirstExposuresThreshold
    })

    // browser has to send ingestion much more often to make sure
    // data is not lost because user closes a window
    if (sdkInfo.name === 'js' || sdkInfo.name === 'react') {
      this.ingestionStrategy.setSendFirstExposuresThreshold(0)
      this.ingestionStrategy.setIngestionInterval(250)
    }
  }

  public ingestExposure(
    methodCalled: string,
    codename: string,
    variation: string,
    isNewFlag: boolean,
    resolutionDescription: string,
    entity?: IEntity,
    hashkey?: string
  ) {
    // skip meaningless ingestion
    if (
      resolutionDescription === Reason.CODENAME_IS_EMPTY ||
      resolutionDescription === Reason.NO_ENTITY_PROVIDED ||
      resolutionDescription === Reason.ID_IS_EMPTY ||
      !entity
    ) {
      logger.warn('Ingestion skipped. Reason: ', resolutionDescription)
      return
    }
    const ingestionData = {
      entities: entity ? [entity] : [],
      exposures: [
        {
          hashkey,
          codename,
          variation,
          entity,
          methodCalled,
          timestamp: new Date().toISOString()
        }
      ],
      sdkInfo: this.sdkInfo,
      detectedFlag: isNewFlag ? codename : undefined
    }
    this.ingest(ingestionData)
  }

  public ingest(data: IIngestionData): void {
    return this.ingestionStrategy.ingest(data)
  }

  public publish(entity: IEntity): void {
    return this.ingestionStrategy.ingest({
      entities: [entity],
      sdkInfo: this.sdkInfo
    })
  }

  public track(event: IEvent): void {
    // do not ingest if there is no entity provided to Flagger
    if (!event.entity && !this.entity) {
      logger.warn('No entity provided to Flagger. Event will not be recorded.')
      return
    }

    let entities: IEntity[] = []
    if (event.entity) {
      entities = [event.entity]
    } else if (this.entity) {
      entities = [this.entity]
      event.entity = this.entity
    }

    return this.ingestionStrategy.ingest({
      entities,
      events: [event],
      sdkInfo: this.sdkInfo
    })
  }

  public setEntity(entity?: IEntity) {
    this.entity = entity
  }

  public setIngestionMaxCalls(ingestionMaxCalls: number) {
    if (this.sdkInfo.name === 'nodejs') {
      this.ingestionStrategy.setIngestionMaxCall(ingestionMaxCalls)
    }
  }

  public setIngestionInterval(intervalInMilliseconds: number) {
    if (this.sdkInfo.name === 'nodejs') {
      this.ingestionStrategy.setIngestionInterval(intervalInMilliseconds)
    }
  }

  public async sendIngestionNow() {
    return this.ingestionStrategy.sendIngestionNow()
  }
}
