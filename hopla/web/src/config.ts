/** Görünüm ayarları. Oyunun sonucunu etkileyen her şey hopla/core/sim.ts'tedir. */
import { PHYSICS } from '../../core/sim'

export const COLORS = {
  /** Kahraman: sahnedeki tek doygun renk */
  hero: 0xf2551d,
  /** Platform tonları (sim.TONES ile aynı sayıda) */
  tones: [0xffffff, 0xece6de, 0xffb994, 0xd8d2ca, 0xffa673, 0x47423f, 0xf6e8d9],
  shadow: 0x5a4434,
  ring: 0xffffff,
} as const

export const VIEW = {
  /** Dikey ekranda yatayda görünen dünya genişliği (birim) */
  width: 11.5,
  /** Yatay/geniş ekranlarda en az görünen yükseklik */
  minHeight: 15,
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
  /** Kapsülün düz gövde uzunluğu; toplam boy = length + 2·radius */
  length: 0.66,
}

/** Şarj sırasında ezilme (0..1 şarjda) */
export const SQUASH = {
  heroY: 0.4,
  heroXZ: 0.17,
  platform: 0.17,
}
