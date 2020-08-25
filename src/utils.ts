export const wait = (fn: () => void, timeout: number) => {
  return new Promise(resolve => {
    setTimeout(() => {
      fn()
      resolve()
    }, timeout)
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
