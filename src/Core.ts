import md5 from 'md5'
import filtersMatcher from './Filter'
import {Logger} from './Logger/Logger'
import {
  IEntity,
  IFlagConfig,
  IFlaggerConfiguration,
  IFlagResult,
  IFlagVariation
} from './Types'

export function getHashedValue(id: string): number {
  return parseInt(md5(id), 16) / 340282366920938463463374607431768211455
}

const logger = new Logger('Core')

export interface ICoreInterface {
  evaluateFlagProperties(
    codename: string,
    overrideEntity?: IEntity
  ): IFlagResult

  setEntity(entity: IEntity): void
}

export enum Reason {
  NO_ENTITY_PROVIDED = 'No entity provided to Flagger',
  CODENAME_IS_EMPTY = 'Flag codename is empty',
  ID_IS_EMPTY = 'Id is empty',
  FLAG_CONFIG_IS_EMPTY = 'No flags in the current config',
  FLAG_NOT_IN_CONFIG = 'Flag is not in the current config',
  KILL_SWITCH_ENGAGED = 'Kill switch engaged',
  INDIVIDUAL_BLACKLIST = 'Entity is individually blacklisted',
  INDIVIDUAL_WHITELIST = 'Entity is individually whitelisted',
  GROUP_BLACKLIST = "Entity's group is blacklisted",
  GROUP_WHITELIST = "Entity's group is whitelisted",
  FLAG_IS_SAMPLED = 'Entity selected via sampling from a subpopulation',
  DEFAULT = 'Default (off) treatment reached'
}

export class Core implements ICoreInterface {
  private static getEmptyVariation(): IFlagVariation {
    return {codename: 'off', probability: 1.0, payload: {}}
  }
  private entity?: IEntity
  private flaggerConfig!: IFlaggerConfiguration

  constructor(flaggerConfig?: IFlaggerConfiguration) {
    if (flaggerConfig) {
      this.flaggerConfig = flaggerConfig
    }
  }

  /**
   * this method evaluates field of Flag: isEnabled, isSampled and so on
   * returns DTO that has all info about Flag and ingestion data.
   *
   * @param codename name of the flag
   * @param overrideEntity entity instead of this.entity
   */
  public evaluateFlagProperties(
    codename: string,
    overrideEntity?: IEntity
  ): IFlagResult {
    // this.flaggerConfig <- current flagger configuration

    const entity = overrideEntity ? overrideEntity : this.entity
    if (!entity) {
      return this.getEmptyFlag(codename, Reason.NO_ENTITY_PROVIDED, false)
    }

    if (entity.id === '') {
      logger.warn(
        'id is empty, returning "off" variation for codename, entity ',
        codename,
        entity
      )
      return this.getEmptyFlag(codename, Reason.ID_IS_EMPTY, false, entity)
    }

    if (codename === '') {
      logger.warn(
        'codename is empty, returning "off" variation for entity: ',
        entity
      )
      return this.getEmptyFlag(
        codename,
        Reason.CODENAME_IS_EMPTY,
        false,
        entity
      )
    }

    if (
      !this.flaggerConfig ||
      !this.flaggerConfig.flags ||
      this.flaggerConfig.flags.length === 0
    ) {
      // no flags at all in config
      return this.getEmptyFlag(
        codename,
        Reason.FLAG_CONFIG_IS_EMPTY,
        true,
        entity
      )
    }

    const codenameMap = this.flaggerConfig.flags.map(f => f.codename)
    const flagIndexOf = codenameMap.indexOf(codename)
    if (flagIndexOf === -1) {
      // current flag is not in config
      return this.getEmptyFlag(
        codename,
        Reason.FLAG_NOT_IN_CONFIG,
        true,
        entity
      )
    }
    const flagFromConfig = this.flaggerConfig.flags[flagIndexOf]

    const envHashKey = this.flaggerConfig.hashKey
    const samplingKey =
      envHashKey + flagFromConfig.hashkey + entity.id + entity.type

    if (flagFromConfig.killSwitchEngaged) {
      // flag is in config but kill switch is on
      return this.getEmptyFlag(
        codename,
        Reason.KILL_SWITCH_ENGAGED,
        false,
        entity,
        flagFromConfig.hashkey
      )
    }

    // 2. Individual Blacklist
    if (flagFromConfig.blacklist) {
      for (const blacklistEntity of flagFromConfig.blacklist) {
        if (
          entity.type &&
          entity.type === blacklistEntity.type &&
          blacklistEntity.id === entity.id
        ) {
          return this.getEmptyFlag(
            codename,
            Reason.INDIVIDUAL_BLACKLIST,
            false,
            entity,
            flagFromConfig.hashkey
          )
        }
      }
    }

    // 3. Individual Whitelist
    if (flagFromConfig.whitelist) {
      for (const whitelistEntity of flagFromConfig.whitelist) {
        if (
          entity.type === whitelistEntity.type &&
          entity.id === whitelistEntity.id
        ) {
          const variation = this.extractVariationFromFlag(
            flagFromConfig,
            whitelistEntity.variation
          )
          return {
            hashkey: flagFromConfig.hashkey,
            codename,
            isEnabled: true,
            isSampled: false,
            payload: variation ? variation.payload : {},
            variation,
            entity,
            reason: Reason.INDIVIDUAL_WHITELIST,
            newFlag: false
          }
        }
      }
    }

    // 4. Group Blacklist
    if (flagFromConfig.blacklist) {
      for (const blacklistEntity of flagFromConfig.blacklist) {
        if (
          entity.group &&
          entity.group.id === blacklistEntity.id &&
          entity.group.type === blacklistEntity.type
        ) {
          return this.getEmptyFlag(
            codename,
            Reason.GROUP_BLACKLIST,
            false,
            entity,
            flagFromConfig.hashkey
          )
        }
      }
    }

    // 5. Group Whitelist
    if (flagFromConfig.whitelist) {
      for (const whitelistEntity of flagFromConfig.whitelist) {
        if (
          entity.group &&
          entity.group.type === whitelistEntity.type &&
          entity.group.id === whitelistEntity.id
        ) {
          const variation = this.extractVariationFromFlag(
            flagFromConfig,
            whitelistEntity.variation
          )
          return {
            hashkey: flagFromConfig.hashkey,
            codename,
            isEnabled: true,
            isSampled: false,
            payload: variation ? variation.payload : {},
            variation,
            entity,
            reason: Reason.GROUP_WHITELIST,
            newFlag: false
          }
        }
      }
    }

    // 6. Subpopulation Sampling
    if (flagFromConfig.subpopulations) {
      for (const subpopulation of flagFromConfig.subpopulations) {
        const hashedId = getHashedValue(samplingKey)
        logger.debug(
          `Hash value is ${hashedId} for flag '${flagFromConfig.codename}'`
        )
        let entityType
        if (entity.type === subpopulation.entityType) {
          entityType = entity.type
        }
        if (entity.group && entity.group.type === subpopulation.entityType) {
          entityType = entity.group.type
        }

        if (
          entityType &&
          filtersMatcher(subpopulation.filters, entity.attributes) &&
          hashedId < subpopulation.samplingPercentage
        ) {
          const variation = this.chooseVariation(
            codename,
            entityType,
            entity.id,
            flagFromConfig.variations
          )

          return {
            hashkey: flagFromConfig.hashkey,
            codename,
            isEnabled: !flagFromConfig.killSwitchEngaged,
            isSampled: true,
            payload: variation ? variation.payload : {},
            variation,
            entity,
            reason: Reason.FLAG_IS_SAMPLED,
            newFlag: false
          }
        }
      }
    }

    // 7. Off/Default Treatment
    return this.getEmptyFlag(
      codename,
      Reason.DEFAULT,
      false,
      entity,
      flagFromConfig.hashkey
    )
  }

  public setEntity(entity?: IEntity): void {
    this.entity = entity
  }

  public setConfig(config: IFlaggerConfiguration) {
    this.flaggerConfig = config
  }

  public getEntity(): IEntity | undefined {
    return this.entity
  }

  private chooseVariation(
    flagCodename: string,
    entityType: string,
    entityId: string,
    variations?: IFlagVariation[]
  ): IFlagVariation {
    if (!variations) {
      return Core.getEmptyVariation()
    }
    const allocationHashKey = flagCodename + entityId + entityType
    const allocationHashedPercentage = getHashedValue(allocationHashKey)
    let cummulativeSum = 0

    for (const variation of variations) {
      cummulativeSum += variation.probability
      if (cummulativeSum > allocationHashedPercentage) {
        return variation
      }
    }
    return Core.getEmptyVariation()
  }

  private extractVariationFromFlag(
    flagConfig: IFlagConfig,
    variationCodename: string
  ): IFlagVariation {
    if (!flagConfig.variations) {
      return Core.getEmptyVariation()
    } else {
      for (const variation of flagConfig.variations) {
        if (variation.codename === variationCodename) {
          return variation
        }
      }
      return Core.getEmptyVariation()
    }
  }

  private getEmptyFlag(
    codename: string,
    reason: Reason,
    newFlag: boolean,
    entity?: IEntity,
    hashkey?: string
  ): IFlagResult {
    const variation = Core.getEmptyVariation()

    return {
      hashkey,
      codename,
      isEnabled: false,
      isSampled: false,
      payload: variation.payload,
      variation,
      entity,
      reason,
      newFlag
    }
  }
}
