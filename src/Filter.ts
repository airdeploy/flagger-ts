import {
  escapeAttributes,
  FilterType,
  IAttributes,
  IFilter,
  IFilterValue
} from './Types'

export enum FilterOperator {
  IS = 'IS',
  IS_NOT = 'IS_NOT',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  LT = 'LT',
  GT = 'GT',
  LTE = 'LTE',
  GTE = 'GTE'
}

const match = (
  operator: FilterOperator,
  attributeValue: any,
  filterValue: any
) => {
  switch (operator) {
    case FilterOperator.IS: {
      return attributeValue === filterValue
    }
    case FilterOperator.IS_NOT: {
      return attributeValue !== filterValue
    }
    case FilterOperator.GT: {
      return attributeValue > filterValue
    }
    case FilterOperator.GTE: {
      return attributeValue >= filterValue
    }
    case FilterOperator.LT: {
      return attributeValue < filterValue
    }
    case FilterOperator.LTE: {
      return attributeValue <= filterValue
    }
    case FilterOperator.IN: {
      if (filterValue instanceof Array) {
        return filterValue.indexOf(attributeValue) !== -1
      } else {
        return false
      }
    }

    case FilterOperator.NOT_IN: {
      if (filterValue instanceof Array) {
        return filterValue.indexOf(attributeValue) === -1
      } else {
        return false
      }
    }
    default:
      return false
  }
}

/**
 * this function tries to parse value as a Date, returns .getTime() value
 * @param value
 */
function parseDateValue(value: any): number | null {
  const temp = value
  switch (typeof value) {
    case 'string':
      value = new Date(temp).getTime()
      if (!value) {
        value = new Date(parseInt(temp)).getTime()
        return value ? value : null
      }
      return value
    case 'number':
      value = new Date(temp).getTime()
      return value
    default:
      return null
  }
}

function escapeAttributeValue(value: any, type: FilterType) {
  if (type === FilterType.DATE) {
    return parseDateValue(value)
  }
  return value
}

export function escapeFilterValue(
  filterValue: any,
  type: FilterType
): IFilterValue {
  if (type === FilterType.DATE) {
    if (filterValue instanceof Array) {
      const temp = []
      for (const filter of filterValue) {
        temp.push(new Date(filter).getTime())
      }
      return temp
    } else {
      return new Date(filterValue).getTime()
    }
  } else {
    return filterValue
  }
}

export default function filtersMatcher(
  filters: IFilter[],
  attributes?: IAttributes
): boolean {
  if (!filters || filters.length === 0) {
    return true
  }
  if (!attributes) {
    return false
  }

  // verify attributeValue type
  for (const [, value] of Object.entries(attributes)) {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      return false
    }
  }

  attributes = escapeAttributes(attributes)

  for (const filter of filters) {
    const attribute = attributes[filter.attributeName.toLowerCase()]

    if (
      typeof attribute === 'undefined' &&
      filter.operator !== FilterOperator.IS_NOT &&
      filter.operator !== FilterOperator.NOT_IN
    ) {
      return false
    }

    const filterValue = escapeFilterValue(filter.value, filter.type)
    const attributeValue = escapeAttributeValue(attribute, filter.type)
    const result = match(filter.operator, attributeValue, filterValue)
    if (!result) {
      return false
    }
  }

  return true
}
