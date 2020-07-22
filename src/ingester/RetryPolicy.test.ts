import RetryPolicy from './RetryPolicy'

describe('Retry Policy tests', () => {
  it('2 fails and then successfully send', async () => {
    const policy = new RetryPolicy()

    await policy.sendData('', {}, () => Promise.reject('some connection error'))
    expect(Reflect.get(policy, 'queue').length).toEqual(1)

    await policy.sendData('', {}, () => Promise.reject('some connection error'))
    expect(Reflect.get(policy, 'queue').length).toEqual(2)

    await policy.sendData('', {}, () => Promise.resolve(''))
    expect(Reflect.get(policy, 'queue').length).toEqual(0)
    expect(Reflect.get(policy, 'currentMemorySize')).toEqual(0)
  })

  it("Won't put in queue because of the memory size", async () => {
    const policy = new RetryPolicy()
    policy.setMaxSize(0)

    // send will fail and won't be put in queue because exceeds maxSize
    await policy.sendData('', {}, () => Promise.reject('some connection error'))

    expect(Reflect.get(policy, 'queue').length).toEqual(0)
    expect(Reflect.get(policy, 'currentMemorySize')).toEqual(0)
  })

  it('Queue is full, replace first element', async () => {
    const policy = new RetryPolicy()

    policy.setMaxSize(7)

    // send will fail and must be put in queue
    await policy.sendData('', 'test', () =>
      Promise.reject('some connection error')
    )
    expect(Reflect.get(policy, 'queue').length).toEqual(1)

    await policy.sendData('', 'tes', () =>
      Promise.reject('some connection error')
    )
    expect(Reflect.get(policy, 'queue').length).toEqual(1)
    expect(Reflect.get(policy, 'queue')[0]).toEqual('tes')
  })
})
