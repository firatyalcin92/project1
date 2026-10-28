/** Görünüm ayarları. Oyunun sonucunu etkileyen her şey hopla/core/sim.ts'tedir. */
import { PHYSICS } from '../../core/sim'

export const COLORS = {
  /** Kahraman: sahnedeki tek doygun renk */
  hero: 0xf2551d,
  /**
   * Platform renkleri (sim.TONES ile aynı sayıda): kırık beyaz, petrol yeşili, hardal, çelik mavisi,
   * zeytin, gül kurusu, kömür. Doygunluğu orta: canlı ama göz yormayan, turuncu kahramanla çakışmayan.
   */
  tones: [0xf3efe9, 0x2f8c85, 0xe2a83a, 0x4e6e9e, 0x86a05a, 0xd3828c, 0x3f3c3a],
  /** Televizyon ekranı vb. koyu ayrıntılar */
  detail: 0x26262b,
  shadow: 0x5a4434,
  ring: 0xffffff,
} as const

export const VIEW = {
  /** Dikey ekranda yatayda görünen dünya genişliği (birim) */
  width: 11.5,
  /** Yatay/geniş ekranlarda en az görünen yükseklik */
  minHeight: 15,
  /** Büyük ekranlarda bir dünya biriminin en fazla kaç CSS pikseli olacağı */
  maxPxPerUnit: 58,
  /** Odak noktası ekranın üstünden bu oranda aşağıda */
  focusFromTop: 0.57,
  /** Kameranın odağa göre konumu (izometriğe yakın, ~44° yükseklik) */
  cameraOffset: [-10, 13.6, 10] as const,
  /** Güneşin odağa göre konumu: gölgeler sağ-yukarıya düşer */
  sunOffset: [-7, 13, 3.5] as const,
  /** Kamera takibinin yumuşaklığı (büyük = hızlı) */
  follow: 5.5,
}

export const HERO = {
  /** Taban yarıçapı fizikle aynı olmalı (kenardan devrilme hesabı) */
  radius: PHYSICS.heroRadius,
  /** Fasulye insanın boyu (uzun boy, basılı tutunca ezilmesi belli olsun diye) */
  height: 1.52,
}

/** Şarj sırasında ezilme (0..1 şarjda) */
export const SQUASH = {
  heroY: 0.45,
  heroXZ: 0.2,
  platform: 0.17,
}
