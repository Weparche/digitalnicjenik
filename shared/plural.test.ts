import { describe, expect, it } from 'vitest'
import { stavke, stavkeNema } from './plural'

describe('Croatian plural', () => {
  it('uses stavka / stavke / stavki', () => {
    expect([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 112].map(stavke)).toEqual(['0 stavki', '1 stavka', '2 stavke', '4 stavke', '5 stavki', '11 stavki', '12 stavki', '14 stavki', '21 stavka', '22 stavke', '25 stavki', '101 stavka', '112 stavki'])
    expect([1, 3, 6].map(stavkeNema)).toEqual(['1 stavka nema', '3 stavke nemaju', '6 stavki nema'])
  })
})
