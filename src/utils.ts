export const wait = (fn: () => void, timeout: number) => {
  return new Promise(resolve => {
    setTimeout(() => {
      fn()
      resolve()
    }, timeout)
  })
}
