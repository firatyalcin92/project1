/**
 * Sentezlenmiş, çok kısa ve yumuşak sesler (dosya yok). İlk dokunuşta açılır;
 * iOS'ta sessiz moda uyar (audioSession 'ambient').
 */
export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private charge: { osc: OscillatorNode; gain: GainNode } | null = null
  enabled: boolean

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  /** Kullanıcı hareketi içinde çağrılmalı (tarayıcı kuralı). */
  unlock() {
    if (!this.enabled) return
    if (this.ctx) {
      // iOS dokunuşta sesi yalnızca parmak kalkınca (touchend/pointerup) açar: her fırsatta yeniden dene.
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
      return
    }
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } }
      if (nav.audioSession) nav.audioSession.type = 'ambient'
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.55
      this.master.connect(this.ctx.destination)
      // Eski iOS sürümleri için: kullanıcı hareketi içinde kısa sessiz bir ses çal.
      const silent = this.ctx.createBufferSource()
      silent.buffer = this.ctx.createBuffer(1, 1, 22050)
      silent.connect(this.ctx.destination)
      silent.start(0)
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
    } catch {
      this.ctx = null
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) this.stopCharge()
    if (on) this.unlock()
    void this.ctx?.[on ? 'resume' : 'suspend']().catch(() => {})
  }

  private ready() {
    if (!this.enabled || !this.ctx || !this.master) return null
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
    return this.ctx
  }

  /** Şarj: basılı tutuldukça yükselen yumuşak ton */
  startCharge(holdMaxMs: number) {
    const ctx = this.ready()
    if (!ctx) return
    this.stopCharge()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(196, now)
    osc.frequency.linearRampToValueAtTime(588, now + holdMaxMs / 1000)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.07, now + 0.06)
    osc.connect(gain).connect(this.master!)
    osc.start(now)
    this.charge = { osc, gain }
  }

  stopCharge() {
    const c = this.charge
    if (!c || !this.ctx) return
    this.charge = null
    const now = this.ctx.currentTime
    c.gain.gain.cancelScheduledValues(now)
    c.gain.gain.setValueAtTime(c.gain.gain.value, now)
    c.gain.gain.linearRampToValueAtTime(0, now + 0.05)
    c.osc.stop(now + 0.06)
  }

  private tone(freq: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
    const ctx = this.ready()
    if (!ctx) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    osc.frequency.exponentialRampToValueAtTime(to, t0 + duration)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(gain).connect(this.master!)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  land() {
    this.tone(240, 110, 0.12, 0.35)
  }

  perfect(streak: number) {
    const base = 660 * Math.pow(2, Math.min(streak - 1, 6) / 12)
    this.tone(base, base, 0.16, 0.16, 'sine')
    this.tone(base * 1.5, base * 1.5, 0.24, 0.12, 'sine', 0.07)
  }

  fall() {
    this.tone(150, 55, 0.32, 0.4)
  }
}
