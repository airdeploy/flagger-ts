import {Flagger} from './Flagger'

describe('Flagger test', () => {
  it('flagIsEnabled called without init', () => {
    expect(Flagger.isEnabled('test')).toBeFalsy()
  })
  it('flagIsSampled called without init', () => {
    expect(Flagger.isSampled('test')).toBeFalsy()
  })
  it('flagGetVariation called without init', () => {
    expect(Flagger.getVariation('test')).toEqual('off')
  })
  it('flagGetPayload called without init', () => {
    expect(Flagger.getPayload('test')).toEqual({})
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
    Flagger.isSampled('whatever', entity)
    Flagger.isEnabled('whatever', entity)
    Flagger.getVariation('whatever', entity)
    Flagger.getPayload('whatever', entity)
    Flagger.setEntity(entity)
    Flagger.track('whatever', {}, entity)
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
