import {Logger, LogLevel} from './Logger'

describe('Logger tests', () => {
  it('parseLevel test', () => {
    expect(Logger.parseLevel('test')).toBe(LogLevel.ERROR)

    expect(Logger.parseLevel('warn')).toBe(LogLevel.WARN)
    expect(Logger.parseLevel('WaRn')).toBe(LogLevel.WARN)
    expect(Logger.parseLevel('WARNING')).toBe(LogLevel.WARN)
    expect(Logger.parseLevel('warning')).toBe(LogLevel.WARN)

    expect(Logger.parseLevel('debug')).toBe(LogLevel.DEBUG)
    expect(Logger.parseLevel('DEBUG')).toBe(LogLevel.DEBUG)
    expect(Logger.parseLevel('deb')).toBe(LogLevel.DEBUG)
    expect(Logger.parseLevel('DeB')).toBe(LogLevel.DEBUG)

    expect(Logger.parseLevel('err')).toBe(LogLevel.ERROR)
    expect(Logger.parseLevel('ERR')).toBe(LogLevel.ERROR)
    expect(Logger.parseLevel('ERRoR')).toBe(LogLevel.ERROR)
    expect(Logger.parseLevel('error')).toBe(LogLevel.ERROR)
  })
})
