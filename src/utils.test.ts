import {deepEqual} from './utils'

describe('utils tests', () => {
  test('deepEqual() tests', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('foo', 'foo')).toBe(true)
    expect(deepEqual([], [])).toBe(true)
    expect(deepEqual([1, 2, 3, 4], [1, 2, 3, 4])).toBe(true)
    expect(deepEqual({}, {})).toBe(true)
    expect(deepEqual({foo: 'bar'}, {foo: 'bar'})).toBe(true)
    expect(deepEqual([{}], [{}])).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(true, true)).toBe(true)
    expect(deepEqual(undefined, undefined)).toBe(true)
    expect(deepEqual(new Date(42), new Date(42))).toBe(true)
    expect(
      deepEqual(
        {foo: 'bar', arr: [1, 2, 3, 4, '5', true], str: 'string', num: 42},
        {foo: 'bar', arr: [1, 2, 3, 4, '5', true], str: 'string', num: 42}
      )
    ).toBe(true)

    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual(1, '2')).toBe(false)
    expect(deepEqual('1', 2)).toBe(false)
    expect(deepEqual('foo', 'bar')).toBe(false)
    expect(deepEqual([1], [])).toBe(false)
    expect(deepEqual([], {})).toBe(false)
    expect(deepEqual([1, 2, 3, 4], [1, 2, 3, 4, 5])).toBe(false)
    expect(deepEqual({foo: 'bar'}, {})).toBe(false)
    expect(deepEqual({foo: 'bar'}, {foo: 'bar', answer: 42})).toBe(false)
    expect(deepEqual([{}], [{}, true])).toBe(false)
    expect(deepEqual([{}], [{}, {}])).toBe(false)
    expect(deepEqual(0, null)).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
    expect(deepEqual(true, false)).toBe(false)
    expect(deepEqual(undefined, null)).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual(new Date(42), new Date(41))).toBe(false)
    expect(deepEqual(new Date(42), {})).toBe(false)
    expect(
      deepEqual(
        {foo: 'bar', arr: [1, 2, 3, 4, '5', true], str: 'string', num: 42},
        {foo: 'bar', arr: [1, 2, 3, 4, '5', false], str: 'string', num: 42}
      )
    ).toBe(false)
  })
})
