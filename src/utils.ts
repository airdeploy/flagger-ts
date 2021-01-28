import {Logger, LogLevel, LogLevelStrings} from './Logger/Logger'

export const wait = (fn: () => void, timeout: number) => {
  return new Promise(resolve => {
    setTimeout(() => {
      fn()
      resolve()
    }, timeout)
  })
}

export const waitTime = async (milliseconds: number) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}

export const deepEqual = (a: any, b: any): boolean => {
  const aType = typeof a
  const bType = typeof b
  if (aType !== bType) {
    return false
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false
    }
    if (a.length !== b.length) {
      return false
    }
    return a.every((el, i) => deepEqual(el, b[i]))
  }
  if (aType === 'object') {
    if (a === null) {
      if (b !== null) {
        return false
      }
      return true
    }
    if (a instanceof Date) {
      if (!(b instanceof Date)) {
        return false
      }
      return Number(a) === Number(b)
    }
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
      return false
    }
    return aKeys.every(k => deepEqual(a[k], b[k]))
  }
  return a === b
}

export const getRandomInRange = (upperLimit: number): number => {
  return Math.floor(Math.random() * upperLimit) + 1
}

interface IInputArgs {
  apiKey?: string
  sourceURL?: string
  backupSourceURL?: string
  sseURL?: string
  ingestionURL?: string
  logLevel?: LogLevelStrings | LogLevel
}

interface IArgsWithEnv {
  apiKey: string
  sourceURL?: string
  backupSourceURL?: string
  sseURL?: string
  ingestionURL?: string
  logLevel: LogLevel
}

enum FlaggerEnvVars {
  API_KEY = 'FLAGGER_API_KEY',
  SOURCE_URL = 'FLAGGER_SOURCE_URL',
  BACKUP_SOURCE_URL = 'FLAGGER_BACKUP_SOURCE_URL',
  SSE_URL = 'FLAGGER_SSE_URL',
  INGESTION_URL = 'FLAGGER_INGESTION_URL',
  LOG_LEVEL = 'FLAGGER_LOG_LEVEL'
}

export const populateArgsWithEnv = (
  config: IInputArgs
): [IArgsWithEnv?, Error?] => {
  const apiKey = getVarOrEnv(config.apiKey, FlaggerEnvVars.API_KEY)
  if (!apiKey) {
    return [
      undefined,
      new Error(
        'You must provide apiKeys: 1) Define FLAGGER_API_KEY environment variable before init() call. 2) Provide apiKey argument to init()'
      )
    ]
  }

  // parse config from init method, or take it from env var, fallback to error
  let loglevel: LogLevel = LogLevel.error
  if (config.logLevel) {
    if (typeof config.logLevel === 'string') {
      loglevel = Logger.parseLevel(config.logLevel)
    } else {
      loglevel = config.logLevel
    }
  } else {
    const levelFromEnv = getEnv(FlaggerEnvVars.LOG_LEVEL)
    if (levelFromEnv) {
      loglevel = Logger.parseLevel(levelFromEnv)
    }
  }

  return [
    {
      apiKey,
      sourceURL: getVarOrEnv(config.sourceURL, FlaggerEnvVars.SOURCE_URL),
      backupSourceURL: getVarOrEnv(
        config.backupSourceURL,
        FlaggerEnvVars.BACKUP_SOURCE_URL
      ),
      sseURL: getVarOrEnv(config.sseURL, FlaggerEnvVars.SSE_URL),
      ingestionURL: getVarOrEnv(
        config.ingestionURL,
        FlaggerEnvVars.INGESTION_URL
      ),
      logLevel: loglevel
    }
  ]
}

const getVarOrEnv = (
  variable: string | undefined,
  envVar: string
): string | undefined => {
  return variable ? variable : getEnv(envVar)
}

const getEnv = (env: string): string | undefined => {
  return process && process.env && process.env[env]
}
