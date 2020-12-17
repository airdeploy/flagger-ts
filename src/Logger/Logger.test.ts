import {Logger, LogLevel} from './Logger'

describe('Logger tests', () => {
  it('parseLevel test', () => {
    expect(Logger.parseLevel('test')).toBe(LogLevel.error)

    expect(Logger.parseLevel('warn')).toBe(LogLevel.warn)
    expect(Logger.parseLevel('WaRn')).toBe(LogLevel.warn)
    expect(Logger.parseLevel('WARNING')).toBe(LogLevel.warn)
    expect(Logger.parseLevel('warning')).toBe(LogLevel.warn)

    expect(Logger.parseLevel('debug')).toBe(LogLevel.debug)
    expect(Logger.parseLevel('DEBUG')).toBe(LogLevel.debug)
    expect(Logger.parseLevel('deb')).toBe(LogLevel.debug)
    expect(Logger.parseLevel('DeB')).toBe(LogLevel.debug)

    expect(Logger.parseLevel('err')).toBe(LogLevel.error)
    expect(Logger.parseLevel('ERR')).toBe(LogLevel.error)
    expect(Logger.parseLevel('ERRoR')).toBe(LogLevel.error)
    expect(Logger.parseLevel('error')).toBe(LogLevel.error)
  })
})
