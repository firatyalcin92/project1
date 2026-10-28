import { NAME_MAX, checkNameShape, cleanName, type Profile } from '../../core/api'
import { COUNTRY_CODES, flagEmoji, guessCountry, isCountryCode } from '../../core/countries'
import type { RunResult } from './game'
import { LANG, countryName, errorText, t } from './i18n'
import { ApiFailure, type Net, type SubmitStatus } from './net'

/**
 * DOM arayüzü: skor, başlık, bitti kartı, isim ve sıralama pencereleri.
 * Oyuncu adları her zaman textContent ile yazılır (asla HTML olarak değil).
 */

const ICON = {
  trophy:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 6h2.5a.5.5 0 0 1 .5.5V7a3 3 0 0 1-3 3M7 6H4.5a.5.5 0 0 0-.5.5V7a3 3 0 0 0 3 3"/></svg>',
  soundOn:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  soundOff:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4ZM16 9.5l5 5M21 9.5l-5 5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
}

type Child = Node | string | null | undefined | false

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener)
    else if (k === 'html') el.innerHTML = String(v)
    else if (k === 'text') el.textContent = String(v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children) if (c) el.append(c)
  return el
}

const fmt = (n: number) => n.toLocaleString(LANG === 'tr' ? 'tr-TR' : undefined)

export interface UIHandlers {
  restart(): void
  toggleSound(): boolean
  soundOn(): boolean
  /** İsim kaydedildikten sonra (bekleyen skor gönderilir) */
  registered(): void
}

export class UI {
  private readonly hud: HTMLElement
  private readonly scoreEl: HTMLElement
  private readonly title: HTMLElement
  private readonly chip: HTMLButtonElement
  private readonly soundBtn: HTMLButtonElement
  private readonly fade: HTMLElement
  private readonly toastEl: HTMLElement
  private overEl: HTMLElement | null = null
  private overStatus: HTMLElement | null = null
  private overShownAt = 0
  private toastTimer = 0
  sheetOpen = false

  constructor(
    private readonly root: HTMLElement,
    private readonly net: Net,
    private readonly handlers: UIHandlers,
  ) {
    this.scoreEl = h('div', { class: 'score', 'aria-live': 'off' }, '0')
    this.hud = h('div', { class: 'hud hidden' }, this.scoreEl)

    this.chip = h('button', { class: 'chip', type: 'button', onclick: () => this.openName() })
    this.soundBtn = h('button', {
      class: 'icon',
      type: 'button',
      onclick: () => {
        handlers.toggleSound()
        this.paintSound()
      },
    })
    const board = h('button', {
      class: 'icon',
      type: 'button',
      'aria-label': t.leaderboard,
      html: ICON.trophy,
      onclick: () => this.openLeaderboard(),
    })
    this.title = h(
      'div',
      { class: 'title' },
      h('div', { class: 'topbar' }, this.chip, h('div', { class: 'spacer' }), this.soundBtn, board),
      h(
        'div',
        { class: 'brand' },
        h('h1', { class: 'wordmark' }, 'hopla', h('span', { class: 'dot', 'aria-hidden': 'true' })),
        h('p', { class: 'tagline' }, t.tagline),
      ),
      h('div', { class: 'hint' }, h('span', { class: 'press', 'aria-hidden': 'true' }), t.hint),
    )
    this.fade = h('div', { class: 'fade' })
    this.toastEl = h('div', { class: 'toast', role: 'status' })
    root.append(this.hud, this.title, this.fade, this.toastEl)
    this.paintSound()
    this.refreshPlayer()
  }

  // ------------------------------------------------------------ skor

  showHud(show: boolean) {
    this.hud.classList.toggle('hidden', !show)
  }

  setScore(n: number, bump = false) {
    this.scoreEl.textContent = fmt(n)
    if (bump) {
      this.scoreEl.classList.remove('bump')
      void this.scoreEl.offsetWidth
      this.scoreEl.classList.add('bump')
    }
  }

  /** "+3" gibi kısa süreli puan yazısı */
  popup(points: number, perfect: boolean, at: { x: number; y: number }) {
    if (points <= 1 && !perfect) return
    const el = h('div', { class: `pop${perfect ? ' perfect' : ''}` }, `+${points}`)
    el.style.left = `${at.x}px`
    el.style.top = `${at.y}px`
    this.root.append(el)
    requestAnimationFrame(() => el.classList.add('go'))
    setTimeout(() => el.remove(), 900)
  }

  // ------------------------------------------------------------ başlık

  showTitle(show: boolean) {
    this.title.classList.toggle('hidden', !show)
  }

  refreshPlayer() {
    const p = this.net.profile
    this.chip.replaceChildren()
    if (p) {
      this.chip.append(h('span', { class: 'flag' }, flagEmoji(p.country)), h('span', { class: 'name' }, p.name))
      this.chip.setAttribute('aria-label', `${p.name} — ${t.edit}`)
    } else {
      this.chip.append(h('span', { class: 'name' }, t.chooseName))
      this.chip.setAttribute('aria-label', t.chooseName)
    }
  }

  private paintSound() {
    const on = this.handlers.soundOn()
    this.soundBtn.innerHTML = on ? ICON.soundOn : ICON.soundOff
    this.soundBtn.setAttribute('aria-label', on ? t.soundOn : t.soundOff)
  }

  // ------------------------------------------------------------ bitti kartı

  showOver(r: RunResult, best: number, newBest: boolean) {
    this.hideOver()
    this.overStatus = h('div', { class: 'status' })
    const card = h(
      'div',
      { class: 'card over-card', onpointerdown: (e: Event) => e.stopPropagation() },
      h('div', { class: 'label' }, t.score),
      h('div', { class: 'big' }, fmt(r.score)),
      newBest ? h('div', { class: 'badge' }, t.newBest) : h('div', { class: 'best' }, `${t.best} ${fmt(best)}`),
      this.overStatus,
      h('button', { class: 'primary', type: 'button', onclick: () => this.requestRestart() }, t.playAgain),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'link', type: 'button', onclick: () => this.openLeaderboard() }, t.leaderboard),
      ),
    )
    // Kartın dışına dokunmak da yeniden başlatır (kazara dokunuşa karşı kısa bir bekleme ile).
    this.overEl = h(
      'div',
      {
        class: 'over',
        onpointerdown: (e: PointerEvent) => {
          if (e.target === this.overEl) this.requestRestart()
        },
      },
      card,
    )
    this.overShownAt = performance.now()
    this.root.append(this.overEl)
    requestAnimationFrame(() => this.overEl?.classList.add('show'))
  }

  setOverStatus(s: SubmitStatus | { kind: 'pending' }) {
    const el = this.overStatus
    if (!el) return
    el.replaceChildren()
    const p = this.net.profile
    if (s.kind === 'pending') {
      el.append(h('span', { class: 'dim' }, ' '))
      return
    }
    if ((s.kind === 'sent' || s.kind === 'skipped') && p?.rank) {
      el.append(
        h(
          'div',
          { class: 'ranks' },
          h('span', {}, t.rankWorld(p.rank.world)),
          h('span', { class: 'sep' }, '·'),
          h('span', {}, `${flagEmoji(p.country)} #${fmt(p.rank.country)}`),
        ),
      )
      return
    }
    if (s.kind === 'needsName') {
      el.append(h('button', { class: 'secondary', type: 'button', onclick: () => this.openName() }, t.joinPrompt))
      return
    }
    if (s.kind === 'unranked') el.append(h('span', { class: 'dim' }, t.offlineRun))
    else if (s.kind === 'queued') el.append(h('span', { class: 'dim' }, t.notSent))
    else if (s.kind === 'error') el.append(h('span', { class: 'dim' }, errorText(s.code)))
  }

  /** Bitti ekranından yeni oyun (kazara dokunuşa karşı kısa bir bekleme ile). */
  requestRestart() {
    if (!this.overEl || performance.now() - this.overShownAt < 450 || this.sheetOpen) return
    this.handlers.restart()
  }

  hideOver() {
    this.overEl?.remove()
    this.overEl = null
    this.overStatus = null
  }

  // ------------------------------------------------------------ geçiş ve bildirim

  async fadeThrough(fn: () => void) {
    this.fade.classList.add('on')
    await new Promise((r) => setTimeout(r, 170))
    fn()
    requestAnimationFrame(() => this.fade.classList.remove('on'))
  }

  toast(text: string) {
    this.toastEl.textContent = text
    this.toastEl.classList.add('show')
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2600)
  }

  // ------------------------------------------------------------ pencereler

  private sheet(content: HTMLElement, onClose?: () => void) {
    this.sheetOpen = true
    const close = () => {
      host.classList.remove('show')
      setTimeout(() => host.remove(), 180)
      this.sheetOpen = false
      document.removeEventListener('keydown', onKey)
      onClose?.()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const host = h(
      'div',
      {
        class: 'sheet',
        onpointerdown: (e: Event) => {
          if (e.target === host) close()
        },
      },
      content,
    )
    document.addEventListener('keydown', onKey)
    this.root.append(host)
    requestAnimationFrame(() => host.classList.add('show'))
    return close
  }

  /** İsim ve ülke seçimi (ilk açılışta da gösterilir). */
  openName(opts: { first?: boolean; onClose?: () => void } = {}) {
    const p = this.net.profile
    const guessed = guessCountry(
      navigator.languages ?? [navigator.language],
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    const input = h('input', {
      class: 'field',
      type: 'text',
      inputmode: 'text',
      autocomplete: 'nickname',
      autocapitalize: 'words',
      spellcheck: 'false',
      enterkeyhint: 'done',
      maxlength: String(NAME_MAX + 8),
      placeholder: t.namePlaceholder,
      'aria-label': t.namePlaceholder,
    })
    input.value = p?.name ?? ''
    const select = h('select', { class: 'field', 'aria-label': t.country })
    const codes = [...COUNTRY_CODES].sort((a, b) => countryName(a).localeCompare(countryName(b), LANG))
    for (const code of codes) select.append(h('option', { value: code }, `${flagEmoji(code)}  ${countryName(code)}`))
    select.value = p?.country && isCountryCode(p.country) ? p.country : guessed
    const error = h('div', { class: 'error', role: 'alert' })
    const save = h('button', { class: 'primary', type: 'submit' }, t.save)
    const later = h('button', { class: 'link', type: 'button' }, opts.first ? t.notNow : t.close)
    let ctrl: AbortController | null = null

    const form = h(
      'form',
      { class: 'card name-card', novalidate: true },
      h('h2', {}, t.nameTitle),
      input,
      select,
      h('p', { class: 'hint-text' }, t.nameHint),
      error,
      save,
      later,
    )
    const close = this.sheet(form, () => {
      ctrl?.abort()
      opts.onClose?.()
    })
    later.addEventListener('click', () => close())

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const name = cleanName(input.value)
      const country = select.value
      const shape = checkNameShape(name)
      if (shape !== 'ok') {
        error.textContent = errorText(shape)
        input.focus()
        return
      }
      error.textContent = ''
      save.disabled = true
      later.disabled = true
      save.textContent = t.saving
      const slow = setTimeout(() => (save.textContent = t.waking), 3000)
      ctrl = new AbortController()
      try {
        if (this.net.registered && p) {
          const body: { name?: string; country?: string } = {}
          if (name !== p.name) body.name = name
          if (country !== p.country) body.country = country
          if (body.name || body.country) await this.net.update(body)
        } else {
          await this.net.register(name, country, ctrl.signal)
        }
        this.refreshPlayer()
        close()
        this.handlers.registered()
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        error.textContent = errorText(err instanceof ApiFailure ? err.code : 'NETWORK')
      } finally {
        clearTimeout(slow)
        save.disabled = false
        later.disabled = false
        save.textContent = t.save
      }
    })
    if (!this.net.registered) void this.net.prepareRegistration().catch(() => {})
    if (!opts.first) setTimeout(() => input.focus(), 220)
  }

  /** Dünya / ülke / ülkeler sıralaması */
  openLeaderboard() {
    const myCountry =
      this.net.profile?.country ??
      guessCountry(navigator.languages ?? [navigator.language], Intl.DateTimeFormat().resolvedOptions().timeZone)
    const tabs: { key: 'world' | 'country' | 'countries'; label: string }[] = [
      { key: 'world', label: t.world },
      { key: 'country', label: `${flagEmoji(myCountry)} ${countryName(myCountry)}` },
      { key: 'countries', label: t.countries },
    ]
    const list = h('div', { class: 'list' })
    const foot = h('div', { class: 'foot' })
    const tabBar = h('div', { class: 'tabs', role: 'tablist' })
    let token = 0

    const show = async (key: (typeof tabs)[number]['key']) => {
      for (const b of tabBar.children) b.classList.toggle('active', (b as HTMLElement).dataset.key === key)
      const mine = ++token
      list.replaceChildren(h('div', { class: 'empty' }, t.loading))
      foot.replaceChildren()
      try {
        if (key === 'countries') {
          const res = await this.net.countries()
          if (mine !== token) return
          list.replaceChildren()
          if (!res.entries.length) list.append(h('div', { class: 'empty' }, t.empty))
          for (const e of res.entries) {
            list.append(
              h(
                'div',
                { class: `item${e.country === myCountry ? ' me' : ''}` },
                h('span', { class: 'rank' }, String(e.rank)),
                h('span', { class: 'flag' }, flagEmoji(e.country)),
                h(
                  'span',
                  { class: 'who' },
                  h('span', { class: 'name' }, countryName(e.country)),
                  h('span', { class: 'sub' }, t.players(e.players)),
                ),
                h('span', { class: 'pts' }, fmt(e.score)),
              ),
            )
          }
        } else {
          const res = await this.net.leaderboard(key, key === 'country' ? myCountry : undefined)
          if (mine !== token) return
          list.replaceChildren()
          if (!res.entries.length) list.append(h('div', { class: 'empty' }, t.empty))
          const me = this.net.profile?.name
          for (const e of res.entries) {
            list.append(
              h(
                'div',
                { class: `item${e.name === me ? ' me' : ''}` },
                h('span', { class: 'rank' }, String(e.rank)),
                h('span', { class: 'flag' }, flagEmoji(e.country)),
                h('span', { class: 'who' }, h('span', { class: 'name' }, e.name)),
                h('span', { class: 'pts' }, fmt(e.score)),
              ),
            )
          }
          if (res.me && !res.entries.some((e) => e.name === res.me!.name)) {
            foot.append(
              h(
                'div',
                { class: 'item me' },
                h('span', { class: 'rank' }, fmt(res.me.rank)),
                h('span', { class: 'flag' }, flagEmoji(res.me.country)),
                h(
                  'span',
                  { class: 'who' },
                  h('span', { class: 'name' }, res.me.name),
                  h('span', { class: 'sub' }, t.you),
                ),
                h('span', { class: 'pts' }, fmt(res.me.score)),
              ),
            )
          }
        }
        if (this.net.health?.store === 'memory') foot.append(h('p', { class: 'hint-text' }, t.memoryStore))
      } catch (err) {
        if (mine !== token) return
        list.replaceChildren(h('div', { class: 'empty' }, errorText(err instanceof ApiFailure ? err.code : 'NETWORK')))
      }
    }

    for (const tab of tabs) {
      tabBar.append(
        h('button', { type: 'button', role: 'tab', 'data-key': tab.key, onclick: () => void show(tab.key) }, tab.label),
      )
    }
    const closeBtn = h('button', { class: 'icon', type: 'button', 'aria-label': t.close, html: ICON.close })
    const card = h(
      'div',
      { class: 'card board-card' },
      h('div', { class: 'board-head' }, h('h2', {}, t.leaderboard), closeBtn),
      tabBar,
      list,
      foot,
    )
    const close = this.sheet(card)
    closeBtn.addEventListener('click', () => close())
    void show('world')
  }
}
