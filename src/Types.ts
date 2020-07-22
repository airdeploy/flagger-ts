import {FilterOperator} from './Filter'

export interface IWhitelistEntity extends IEntity {
  variation: string
}

export interface IEntity {
  id: string
  group?: IGroup
  type?: string
  name?: string
  attributes?: IAttributes
}

export interface IGroup {
  id: string
  type?: string
  attributes?: IAttributes
}

export interface IFlagConfig {
  hashkey: string
  codename: string
  killSwitchEngaged?: boolean
  variations?: IFlagVariation[]
  subpopulations?: IFlagSubpopulation[]
  blacklist?: IEntity[]
  whitelist?: IWhitelistEntity[]
}

export interface IFlagVariation {
  codename: string
  probability: number
  payload: IFlagPayload
}

interface IFlagPayload {
  [key: string]: string | boolean | number
}

export interface IFlagSubpopulation {
  entityType: string
  samplingPercentage: number
  filters: IFilter[]
}

export interface IFlaggerConfiguration {
  hashKey: string
  sdkConfig: ISDKFlaggerConfiguration
  flags?: IFlagConfig[]
}

export type IAttributeValue = string | number | boolean

export interface IAttributes {
  [attributeName: string]: IAttributeValue
}

export interface ISDKFlaggerConfiguration {
  SDK_INGESTION_INTERVAL: number
  SDK_INGESTION_MAX_CALLS: number
}

export type IFilterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]

export interface IFilter {
  attributeName: string
  operator: FilterOperator
  type: string
  value: IFilterValue
}

export function escapeAttributes(attributes: IAttributes) {
  for (const key in attributes) {
    if (attributes.hasOwnProperty(key)) {
      const value = attributes[key]
      delete attributes[key]
      attributes[key.toLowerCase()] = value
    }
  }
  return attributes
}

/****
 * use this method as early as possible in the API
 * - fills in type User, if type is not defined
 * - copies id, name to attributes if id/type is not defined accordingly
 * - lower case the attribute's keys
 * - returns a copy of an entity
 * @param entity
 */
export function escapeEntity(entity?: IEntity): IEntity | undefined {
  if (!entity) {
    return undefined
  }
  const clone = JSON.parse(JSON.stringify(entity))
  if (!clone.attributes) {
    clone.attributes = {}
  }
  clone.attributes = escapeAttributes(clone.attributes)

  if (!clone.attributes.name && clone.name) {
    clone.attributes.name = clone.name
  }
  if (!clone.attributes.id) {
    clone.attributes.id = clone.id
  }

  if (!clone.type) {
    clone.type = 'User'
  }
  return clone
}

export interface ISDKInfo {
  name: string
  version: string
}

export interface IFlagResult {
  hashkey?: string
  codename: string
  isEnabled: boolean
  isSampled: boolean
  payload: IFlagPayload
  variation: IFlagVariation
  entity?: IEntity
  reason: string
  newFlag: boolean
}
