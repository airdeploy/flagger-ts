import {flagger} from './Flagger'

describe('Flagger test', () => {
  it('flagIsEnabled called without init', () => {
    expect(flagger.isEnabled('test')).toBeFalsy()
  })
  it('flagIsSampled called without init', () => {
    expect(flagger.isSampled('test')).toBeFalsy()
  })
  it('flagGetVariation called without init', () => {
    expect(flagger.getVariation('test')).toEqual('off')
  })
  it('flagGetPayload called without init', () => {
    expect(flagger.getPayload('test')).toEqual({})
  })

  it('Flagger must not mutate passed entity', () => {
    const entity = {
      id: '1',
      attributes: {age: 21, country: 'France', date: '2016-03-16T05:44:23Z'},
      someOtherParams: {
        notThatImportant: {
          age: 21,
          _internalStruct: null
        }
      },
      type: ''
    }
    flagger.isSampled('whatever', entity)
    flagger.isEnabled('whatever', entity)
    flagger.getVariation('whatever', entity)
    flagger.getPayload('whatever', entity)
    flagger.setEntity(entity)
    flagger.track('whatever', {}, entity)
    expect(entity).toStrictEqual({
      id: '1',
      attributes: {age: 21, country: 'France', date: '2016-03-16T05:44:23Z'},
      someOtherParams: {
        notThatImportant: {
          age: 21,
          _internalStruct: null
        }
      },
      type: ''
    })
  })
})
