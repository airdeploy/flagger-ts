// disabling no-console rule for logger
// tslint:disable: no-console
export interface ILogger {
  debug(msg: string): void

  warn(msg: string): void

  error(msg: string): void
}

// 'warn' | 'warning' | 'deb' | 'debug' | 'err' | 'error'
export type LogLevelStrings = keyof typeof LogLevel

export enum LogLevel {
  error,
  err,
  warning,
  warn,
  debug,
  deb
}

/**
 * Write logs
 * @class Logger
 */
export class Logger implements ILogger {
  public static LOG_LEVEL: LogLevel = LogLevel.error

  /**
   * Parse level and return it. By default returns ERROR level
   * @param level argument to parse
   */
  public static parseLevel(level: string): LogLevel {
    if (level.toLowerCase() === 'warn' || level.toLowerCase() === 'warning') {
      return LogLevel.warn
    }
    if (level.toLowerCase() === 'debug' || level.toLowerCase() === 'deb') {
      return LogLevel.debug
    }

    if (level.toLowerCase() === 'err' || level.toLowerCase() === 'error') {
      return LogLevel.error
    }

    return LogLevel.error
  }
  public name: string

  /**
   * @constructor
   * @param {string} name - Name of the logger
   */
  constructor(name: string) {
    this.name = name
  }

  public _padding(n: any) {
    return n < 10 ? '0' + n : '' + n
  }

  public _ts() {
    const dt = new Date()
    return (
      [this._padding(dt.getMinutes()), this._padding(dt.getSeconds())].join(
        ':'
      ) +
      '.' +
      dt.getMilliseconds()
    )
  }

  /**
   * Write log
   * @method
   * @memeberof Logger
   * @param {string} type - log type, default ERROR
   * @param {string|object} msg - Logging message or object
   */
  public _log(type: LogLevel, ...msg: any[]) {
    let loggerLevelName = Logger.LOG_LEVEL
    if ((typeof window as any) !== 'undefined' && (window as any).LOG_LEVEL) {
      loggerLevelName = (window as any).LOG_LEVEL
    }
    const loggerLevel = LogLevel[loggerLevelName]
    const typeLevel = LogLevel[type]
    if (!(typeLevel >= loggerLevel)) {
      // Do nothing if type is not greater than or equal to logger level (handle undefined)
      return
    }

    let log = console.log.bind(console)
    if (type === LogLevel.error && console.error) {
      log = console.error.bind(console)
    }
    if (type === LogLevel.warn && console.warn) {
      log = console.warn.bind(console)
    }

    const prefix = `[${LogLevel[type].toUpperCase()}] ${this._ts()} ${
      this.name
    }`

    if (msg.length === 1 && typeof msg[0] === 'string') {
      log(`${prefix} - ${msg[0]}`)
    } else if (msg.length === 1) {
      log(prefix, msg[0])
    } else if (typeof msg[0] === 'string') {
      let obj = msg.slice(1)
      if (obj.length === 1) {
        obj = obj[0]
      }
      log(`${prefix} - ${msg[0]}`, obj)
    } else {
      log(prefix, msg)
    }
  }

  /**
   * Write WARN log
   * @method
   * @memeberof Logger
   * @param {string|object} msg - Logging message or object
   */
  public warn(...msg: any[]) {
    this._log(LogLevel.warn, ...msg)
  }

  /**
   * Write ERROR log
   * @method
   * @memeberof Logger
   * @param {string|object} msg - Logging message or object
   */
  public error(...msg: any[]) {
    this._log(LogLevel.error, ...msg)
  }

  /**
   * Write DEBUG log
   * @method
   * @memeberof Logger
   * @param {string|object} msg - Logging message or object
   */
  public debug(...msg: any[]) {
    this._log(LogLevel.debug, ...msg)
  }
}
