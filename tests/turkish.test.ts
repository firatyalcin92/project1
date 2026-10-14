import { describe, expect, it } from 'vitest'
import { ablative, accusative, dative, genitive, locative, withName } from '~/lib/turkish'

describe('Türkçe ek uyumu', () => {
  it.each([
    ['Ayşe', 'Ayşe’nin'],
    ['Fırat', 'Fırat’ın'],
    ['Umut', 'Umut’un'],
    ['Gül', 'Gül’ün'],
    ['Ece', 'Ece’nin'],
    ['İlker', 'İlker’in'],
    ['Burak', 'Burak’ın'],
    ['Oya', 'Oya’nın'],
    ['Doğu', 'Doğu’nun'],
    ['Öykü', 'Öykü’nün'],
  ])('ilgi hâli: %s -> %s', (name, expected) => {
    expect(genitive(name)).toBe(expected)
  })

  it.each([
    ['Ayşe', 'Ayşe’ye'],
    ['Fırat', 'Fırat’a'],
    ['Gül', 'Gül’e'],
    ['Oya', 'Oya’ya'],
  ])('yönelme hâli: %s -> %s', (name, expected) => {
    expect(dative(name)).toBe(expected)
  })

  it.each([
    ['Ayşe', 'Ayşe’den'],
    ['Fırat', 'Fırat’tan'],
    ['Mert', 'Mert’ten'],
    ['Can', 'Can’dan'],
  ])('ayrılma hâli: %s -> %s', (name, expected) => {
    expect(ablative(name)).toBe(expected)
  })

  it('bulunma hâli', () => {
    expect(locative('Ayşe')).toBe('Ayşe’de')
    expect(locative('Fırat')).toBe('Fırat’ta')
    expect(locative('Can')).toBe('Can’da')
  })

  it('belirtme ve "ile" ekleri', () => {
    expect(accusative('Ayşe')).toBe('Ayşe’yi')
    expect(accusative('Fırat')).toBe('Fırat’ı')
    expect(withName('Ayşe')).toBe('Ayşe’yle')
    expect(withName('Fırat')).toBe('Fırat’la')
  })
})
