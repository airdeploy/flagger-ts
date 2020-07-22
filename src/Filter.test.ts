import filtersMatcher, {escapeFilterValue, FilterOperator} from './Filter'
import {IAttributes, IAttributeValue, IFilter, IFilterValue} from './Types'

describe('filter test', () => {
  describe('escape function test', () => {
    it('escapeFilter test', () => {
      expect(escapeFilterValue('2016-03-16T05:44:23Z', 'date')).toEqual(
        1458107063000
      )
      expect(escapeFilterValue(['2016-03-16T05:44:23Z'], 'date')).toEqual([
        1458107063000
      ])
      expect(
        escapeFilterValue(['2016-03-16T05:44:23Z'], 'string')
      ).toMatchObject(['2016-03-16T05:44:23Z'])
    })
  })

  describe('date filter tests', () => {
    const getDateFilters = (
      date: IFilterValue,
      operator?: FilterOperator
    ): IFilter[] => {
      return [
        {
          attributeName: 'bday',
          operator: operator ? operator : FilterOperator.IS,
          type: 'date',
          value: date
        }
      ]
    }
    const getAttribute = (date: IAttributeValue): IAttributes => {
      return {bday: date}
    }

    describe('single value tests', () => {
      it('positive test', () => {
        expect(
          filtersMatcher(
            getDateFilters('2016-03-16T05:44:23Z'),
            getAttribute('2016-03-16T05:44:23Z')
          )
        ).toBeTruthy()
      })
      it("client's value is a number", () => {
        expect(
          filtersMatcher(
            getDateFilters('2016-03-16T05:44:23Z'),
            getAttribute(711185707000)
          )
        ).toBeFalsy()
      })
      it("client's value is a number in string", () => {
        expect(
          filtersMatcher(
            getDateFilters('2016-03-16T05:44:23Z'),
            getAttribute('711185707000')
          )
        ).toBeFalsy()
      })
      it("client's value is in the wrong format, RFC 2822", () => {
        expect(
          filtersMatcher(
            getDateFilters('2016-03-16T05:44:23Z'),
            getAttribute('Fri, 26 Dec 7000 12:12:06 -0200')
          )
        ).toBeFalsy()
      })
      it("server's value is a number", () => {
        expect(
          filtersMatcher(
            getDateFilters(711185707000),
            getAttribute('2016-03-16T05:44:23Z')
          )
        ).toBeFalsy()
      })
      it("client's value is a string", () => {
        expect(
          filtersMatcher(
            getDateFilters('2016-03-16T05:44:23Z'),
            getAttribute('fdsfdsfsd')
          )
        ).toBeFalsy()
      })
      it("client's value is a boolean", () => {
        expect(
          filtersMatcher(
            getDateFilters('2016-03-16T05:44:23Z'),
            getAttribute(true)
          )
        ).toBeFalsy()
      })
      it("values don't match", () => {
        expect(
          filtersMatcher(
            getDateFilters('2016-03-16T05:44:23Z'),
            getAttribute('2019-09-16T05:44:23Z')
          )
        ).toBeFalsy()
      })
    })

    describe('multiple values test', () => {
      it('positive test', () => {
        expect(
          filtersMatcher(
            getDateFilters(['2016-03-16T05:44:23Z'], FilterOperator.IN),
            getAttribute('2016-03-16T05:44:23Z')
          )
        ).toBeTruthy()
      })

      it("wrong type of the client's value", () => {
        expect(
          filtersMatcher(
            getDateFilters(['2016-03-16T05:44:23Z'], FilterOperator.IN),
            getAttribute(false)
          )
        ).toBeFalsy()
      })
      it("wrong type of the client's value", () => {
        expect(
          filtersMatcher(
            getDateFilters(['2016-03-16T05:44:23Z'], FilterOperator.IN),
            getAttribute(711185707000)
          )
        ).toBeFalsy()
      })
    })
  })

  describe('filter edge cases', () => {
    it('undefined and empty', () => {
      expect(filtersMatcher([], undefined)).toBe(true)
      expect(
        filtersMatcher(
          [
            {
              attributeName: 'COUNTRY',
              operator: FilterOperator.IS,
              type: 'string',
              value: 'Japan'
            }
          ],
          undefined
        )
      ).toBe(false)
    })
    it('filter attribute name UPPER CASED', () => {
      const countryFilters = [
        {
          attributeName: 'COUNTRY',
          operator: FilterOperator.IS,
          value: 'Japan',
          type: 'string'
        }
      ]
      expect(
        filtersMatcher(countryFilters, {
          country: 'Japan',
          age: 21,
          admin: true,
          birthday: 711185707000
        })
      ).toBe(true)
    })
    it('entity attribute name UPPER CASED', () => {
      const countryFilters = [
        {
          attributeName: 'CoUnTrY',
          operator: FilterOperator.IS,
          value: 'Japan',
          type: 'string'
        }
      ]
      expect(
        filtersMatcher(countryFilters, {
          COUNTRY: 'Japan',
          age: 21,
          admin: true,
          birthday: 711185707000
        })
      ).toBe(true)
    })
  })
  describe('single filter tests', () => {
    test('is test', () => {
      const countryFilters = [
        {
          attributeName: 'country',
          operator: FilterOperator.IS,
          value: 'Japan',
          type: 'string'
        }
      ]
      const ageFilters = [
        {
          attributeName: 'age',
          operator: FilterOperator.IS,
          value: 21,
          type: 'number'
        }
      ]
      const adminFilters = [
        {
          attributeName: 'admin',
          operator: FilterOperator.IS,
          value: true,
          type: 'boolean'
        }
      ]
      const birthdayFilter = [
        {
          attributeName: 'birthday',
          operator: FilterOperator.IS,
          value: '1992-07-15T07:35:07Z',
          type: 'date'
        }
      ]
      const match = {
        country: 'Japan',
        age: 21,
        admin: true,
        birthday: 711185707000
      }
      const bDayString = {
        birthday: '711185707000'
      }
      const bDayStringDate = {
        birthday: '1992-07-15T07:35:07Z'
      }
      const noMatch = {
        country: 'Kiev',
        age: 36,
        admin: false,
        birthday: 71118434000
      }
      expect(filtersMatcher(countryFilters, match)).toBe(true)
      expect(filtersMatcher(ageFilters, match)).toBe(true)
      expect(filtersMatcher(adminFilters, match)).toBe(true)
      expect(filtersMatcher(birthdayFilter, match)).toBe(true)
      expect(filtersMatcher(birthdayFilter, bDayString)).toBe(true)
      expect(filtersMatcher(birthdayFilter, bDayStringDate)).toBe(true)
      expect(filtersMatcher(countryFilters, noMatch)).toBe(false)
      expect(filtersMatcher(ageFilters, noMatch)).toBe(false)
      expect(filtersMatcher(adminFilters, noMatch)).toBe(false)
      expect(filtersMatcher(countryFilters, noMatch)).toBe(false)
    })
    test('is_not test', () => {
      const countryFilters = [
        {
          attributeName: 'country',
          operator: FilterOperator.IS_NOT,
          value: 'Japan',
          type: 'string'
        }
      ]
      const ageFilters = [
        {
          attributeName: 'age',
          operator: FilterOperator.IS_NOT,
          value: 21,
          type: 'number'
        }
      ]
      const adminFilters = [
        {
          attributeName: 'admin',
          operator: FilterOperator.IS_NOT,
          value: true,
          type: 'boolean'
        }
      ]
      const birthdayUnixFilter = [
        {
          attributeName: 'birthdayUnix',
          operator: FilterOperator.IS_NOT,
          value: 711185707000,
          type: 'date'
        }
      ]
      const noMatch = {
        country: 'Japan',
        age: 21,
        admin: true,
        birthdayUnix: 711185707000
      }
      const match = {
        country: 'Kiev',
        age: 36,
        admin: false,
        birthdayUnix: 71118434000
      }
      expect(filtersMatcher(countryFilters, match)).toBe(true)
      expect(filtersMatcher(ageFilters, match)).toBe(true)
      expect(filtersMatcher(adminFilters, match)).toBe(true)
      expect(filtersMatcher(birthdayUnixFilter, match)).toBe(true)
      expect(filtersMatcher(countryFilters, noMatch)).toBe(false)
      expect(filtersMatcher(ageFilters, noMatch)).toBe(false)
      expect(filtersMatcher(adminFilters, noMatch)).toBe(false)
      expect(filtersMatcher(countryFilters, noMatch)).toBe(false)
    })
    test('lt test', () => {
      const ageFilters = [
        {
          attributeName: 'age',
          operator: FilterOperator.LT,
          value: 21,
          type: 'number'
        }
      ]
      const birthdayUnixFilter = [
        {
          attributeName: 'birthdayUnix',
          operator: FilterOperator.LT,
          value: 711185707000,
          type: 'date'
        }
      ]

      const match = {
        country: 'Japan',
        age: 20,
        admin: true,
        birthdayUnix: 511185707000
      }
      const noMatch = {
        country: 'Kiev',
        age: 36,
        admin: false,
        birthdayUnix: 811185707000
      }
      expect(filtersMatcher(ageFilters, match)).toBe(true)
      expect(filtersMatcher(birthdayUnixFilter, match)).toBe(true)
      expect(filtersMatcher(ageFilters, noMatch)).toBe(false)
      expect(filtersMatcher(birthdayUnixFilter, noMatch)).toBe(false)
    })

    test('lte test', () => {
      const ageFilters = [
        {
          attributeName: 'age',
          operator: FilterOperator.LTE,
          value: 21,
          type: 'number'
        }
      ]
      const birthdayUnixFilter = [
        {
          attributeName: 'birthdayUnix',
          operator: FilterOperator.LTE,
          value: 711185707000,
          type: 'date'
        }
      ]

      const match = {
        country: 'Japan',
        age: 21,
        admin: true,
        birthdayUnix: 711185707000
      }
      const noMatch = {
        country: 'Kiev',
        age: 36,
        admin: false,
        birthdayUnix: 811185707000
      }
      expect(filtersMatcher(ageFilters, match)).toBe(true)
      expect(filtersMatcher(birthdayUnixFilter, match)).toBe(true)
      expect(filtersMatcher(ageFilters, noMatch)).toBe(false)
      expect(filtersMatcher(birthdayUnixFilter, noMatch)).toBe(false)
    })

    test('gt test', () => {
      const ageFilters = [
        {
          attributeName: 'age',
          operator: FilterOperator.GT,
          value: 21,
          type: 'number'
        }
      ]
      const birthdayUnixFilter = [
        {
          attributeName: 'birthdayUnix',
          operator: FilterOperator.GT,
          value: 711185707000,
          type: 'date'
        }
      ]

      const noMatch = {
        country: 'Japan',
        age: 20,
        admin: true,
        birthdayUnix: 711185707000
      }
      const match = {
        country: 'Kiev',
        age: 36,
        admin: false,
        birthdayUnix: 811185707000
      }
      expect(filtersMatcher(ageFilters, match)).toBe(true)
      expect(filtersMatcher(birthdayUnixFilter, match)).toBe(true)
      expect(filtersMatcher(ageFilters, noMatch)).toBe(false)
      expect(filtersMatcher(birthdayUnixFilter, noMatch)).toBe(false)
    })

    test('gte test', () => {
      const ageFilters = [
        {
          attributeName: 'age',
          operator: FilterOperator.GTE,
          value: 21,
          type: 'number'
        }
      ]
      const birthdayUnixFilter = [
        {
          attributeName: 'birthdayUnix',
          operator: FilterOperator.GTE,
          value: 711185707000,
          type: 'date'
        }
      ]

      const noMatch = {
        country: 'Japan',
        age: 20,
        admin: true,
        birthdayUnix: 611185707000
      }
      const match = {
        country: 'Kiev',
        age: 36,
        admin: false,
        birthdayUnix: 811185707000
      }
      expect(filtersMatcher(ageFilters, match)).toBe(true)
      expect(filtersMatcher(birthdayUnixFilter, match)).toBe(true)
      expect(filtersMatcher(ageFilters, noMatch)).toBe(false)
      expect(filtersMatcher(birthdayUnixFilter, noMatch)).toBe(false)
    })

    test('in test', () => {
      const birthdayFilter = [
        {
          attributeName: 'birthday',
          operator: FilterOperator.IN,
          value: [711185707000],
          type: 'date'
        }
      ]
      const match = {
        birthday: 711185707000
      }
      const noMatch = {
        birthday: 711184348000
      }
      expect(filtersMatcher(birthdayFilter, match)).toBe(true)
      expect(filtersMatcher(birthdayFilter, noMatch)).toBe(false)
    })

    test('not_in test', () => {
      const countryFilters = [
        {
          attributeName: 'country',
          operator: FilterOperator.NOT_IN,
          value: ['Japan', 'Ukraine'],
          type: 'string'
        }
      ]
      const match = {
        country: 'France',
        age: 21,
        admin: true,
        birthday: 711185707000
      }
      const noMatch = {
        country: 'Japan',
        age: 36,
        admin: false,
        birthday: 71118434000
      }
      expect(filtersMatcher(countryFilters, match)).toBe(true)
      expect(filtersMatcher(countryFilters, noMatch)).toBe(false)
    })
  })
  describe('multiple filters tests', () => {
    test('is test', () => {
      const filters = [
        {
          attributeName: 'country',
          operator: FilterOperator.IS,
          value: 'Japan',
          type: 'string'
        },
        {
          attributeName: 'age',
          operator: FilterOperator.IS,
          value: 21,
          type: 'number'
        },
        {
          attributeName: 'admin',
          operator: FilterOperator.IS,
          value: true,
          type: 'boolean'
        }
      ]
      const match = {country: 'Japan', age: 21, admin: true}
      const noMatch = {country: 'Japan'} // not enough attributes
      const wrongAge = {country: 'Japan', age: 22, admin: true} // wrong age
      const wrongCountry = {country: 'France', age: 21, admin: true} // wrong country
      const notAdmin = {country: 'Japan', age: 21, admin: false} // wrong admin
      expect(filtersMatcher(filters, match)).toBe(true)
      expect(filtersMatcher(filters, noMatch)).toBe(false)
      expect(filtersMatcher(filters, wrongAge)).toBe(false)
      expect(filtersMatcher(filters, wrongCountry)).toBe(false)
      expect(filtersMatcher(filters, notAdmin)).toBe(false)
    })
    test('is_not test', () => {
      const filters = [
        {
          attributeName: 'country',
          operator: FilterOperator.IS_NOT,
          value: 'Japan',
          type: 'string'
        },
        {
          attributeName: 'age',
          operator: FilterOperator.IS_NOT,
          value: 21,
          type: 'number'
        },
        {
          attributeName: 'admin',
          operator: FilterOperator.IS_NOT,
          value: true,
          type: 'boolean'
        }
      ]
      const match = {country: 'Ukraine', age: 22, admin: false}
      const match2 = {country: 'Ukraine'} // not enough attributes but still ok
      const wrongAge = {country: 'Ukraine', age: 21, admin: false} // wrong age
      const wrongCountry = {country: 'France', age: 22, admin: true} // wrong country
      expect(filtersMatcher(filters, match)).toBe(true)
      expect(filtersMatcher(filters, match2)).toBe(true)
      expect(filtersMatcher(filters, wrongAge)).toBe(false)
      expect(filtersMatcher(filters, wrongCountry)).toBe(false)
    })
  })
})
