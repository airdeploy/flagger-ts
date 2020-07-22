import {IAttributes, IEntity, ISDKInfo} from '../Types'

export interface IIngestionData {
  entities: IEntity[]
  exposures?: IExposure[] // the output of every single API call
  events?: IEvent[] // user generated event
  sdkInfo: ISDKInfo // Dictionary holding info about the Flagger version that's sending data back
  detectedFlag?: string
}

export interface IExposure {
  hashkey?: string
  codename: string
  variation?: string // The string representation of the variation received
  entity: IEntity
  methodCalled: string
  timestamp: string // Date time format
}

export interface IIngestionStrategy {
  ingest(data: IIngestionData, callback: (error: Error) => void): void
}

export interface IEvent {
  name: string
  properties: IAttributes
  entity?: IEntity
  timestamp: string
}

export const DEFAULT_NUMBER_OF_RETRIES = 2
