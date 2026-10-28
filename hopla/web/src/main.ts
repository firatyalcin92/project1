import './style.css'
import { PHYSICS } from '../../core/sim'
import { Sound } from './audio'
import { Game } from './game'
import { LANG } from './i18n'
import { haptic, storage } from './native'
import { Net } from './net'
import { UI } from './ui'
import { World } from './world'

const stage = document.getElementById('stage')!
const uiRoot = document.getElementById('ui')!

function randomSeed() {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]!
}

/** Bazı eski WebKit sürümlerinde event.timeStamp performance.now() ile aynı saatte değil. */
function eventTime(ts: number) {
  const now = performance.now()
  return ts > 0 && Math.abs(now - ts) < 5000 ? ts : now
}

function start() {
  let world: World
  try {
    world = new World(stage)
  } catch {
    uiRoot.innerHTML = ''
    const p = document.createElement('p')
    p.className = 'nogl'
    p.textContent = 'WebGL 2 is required. / Bu cihaz 3D grafikleri desteklemiyor.'
    uiRoot.append(p)
    return
  }

  const net = new Net()
  const sound = new Sound(storage.get('sound') !== '0')
  let best = Number(storage.get('best') ?? 0) || 0
  let streak = 0

  const ui = new UI(uiRoot, net, {
    restart: () =>
      void ui.fadeThrough(() => {
        ui.hideOver()
        game.restart()
        ui.setScore(0)
        ui.showHud(true)
      }),
    toggleSound: () => {
      sound.setEnabled(!sound.enabled)
      storage.set('sound', sound.enabled ? '1' : '0')
      return sound.enabled
    },
    soundOn: () => sound.enabled,
    registered: () => {
      void net.flushPending().then((s) => {
        if (s) ui.setOverStatus(s)
      })
    },
  })

  const game = new Game(
    world,
    {
      prepared: (seed) => net.requestTicket(seed),
      started: () => {
        ui.showTitle(false)
        ui.setScore(0)
        ui.showHud(true)
      },
      charge: (on) => {
        if (on) sound.startCharge(PHYSICS.holdMaxMs)
        else sound.stopCharge()
      },
      landed: ({ points, perfect, score, screen }) => {
        ui.setScore(score, true)
        if (perfect) {
          streak += 1
          sound.perfect(streak)
          haptic('success')
        } else {
          streak = 0
          sound.land()
          haptic('light')
        }
        ui.popup(points, perfect, screen)
      },
      fell: () => {
        streak = 0
        sound.fall()
        haptic('heavy')
      },
      over: (r) => {
        const newBest = r.score > best
        if (newBest) {
          best = r.score
          storage.set('best', String(best))
        }
        ui.showHud(false)
        ui.showOver(r, best, newBest)
        ui.setOverStatus({ kind: 'pending' })
        void net.submit(r).then((s) => ui.setOverStatus(s))
      },
    },
    randomSeed,
  )

  // ------------------------------------------------------------ girdi: basılı tut / bırak
  let pointer: number | null = null
  let keyDown = false

  stage.addEventListener(
    'pointerdown',
    (e) => {
      if (ui.sheetOpen || pointer !== null) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointer = e.pointerId
      try {
        stage.setPointerCapture(e.pointerId)
      } catch {
        // bazı tarayıcılarda gerekmez
      }
      e.preventDefault()
      sound.unlock()
      game.press(eventTime(e.timeStamp))
    },
    { passive: false },
  )
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return
    pointer = null
    game.release(eventTime(e.timeStamp))
  }
  stage.addEventListener('pointerup', up)
  stage.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pointer) return
    pointer = null
    game.cancel()
  })
  stage.addEventListener('contextmenu', (e) => e.preventDefault())

  const isJumpKey = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp'
  const typing = (target: EventTarget | null) =>
    target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName)
  window.addEventListener('keydown', (e) => {
    if (!isJumpKey(e) || e.repeat || ui.sheetOpen || typing(e.target)) return
    e.preventDefault()
    if (game.phase === 'over') {
      ui.requestRestart()
      return
    }
    keyDown = true
    sound.unlock()
    game.press(eventTime(e.timeStamp))
  })
  window.addEventListener('keyup', (e) => {
    if (!isJumpKey(e) || !keyDown) return
    keyDown = false
    game.release(eventTime(e.timeStamp))
  })

  const pause = () => {
    pointer = null
    keyDown = false
    game.cancel()
    sound.stopCharge()
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : game.wake()))
  window.addEventListener('blur', pause)

  new ResizeObserver(() => {
    world.resize()
    game.render()
  }).observe(stage)

  // Yerel kabuk (Expo) uygulama arka plana geçince bunu çağırır.
  ;(window as unknown as { hopla: unknown }).hopla = { pause }
  if (new URLSearchParams(location.search).has('debug')) {
    ;(window as unknown as { __hopla: unknown }).__hopla = { game, net, ui }
  }

  // ------------------------------------------------------------ arka plan işleri
  void net.wake().then(async (health) => {
    if (!health?.ready || !net.token) return
    await net.refresh()
    ui.refreshPlayer()
    await net.flushPending()
  })
  window.addEventListener('online', () => void net.flushPending())

  if (!net.registered && !storage.get('asked')) {
    setTimeout(() => {
      if (game.phase === 'intro') ui.openName({ first: true, onClose: () => storage.set('asked', '1') })
    }, 600)
  }

  document.documentElement.lang = LANG
  game.wake()
}

start()

// Çevrimdışı oynanabilsin diye service worker (yalnızca web sürümünde, https/localhost'ta)
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {})
  })
}
