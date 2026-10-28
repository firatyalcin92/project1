import {
  DirectionalLight,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { COLORS, VIEW } from './config'

/**
 * Sahne, sabit açılı ortografik kamera, ışıklar ve yalnızca gölgeyi gösteren zemin.
 * Kamera odağı (focus) hedefe (goal) yumuşakça yaklaşır; sarsıntı yoktur.
 */
export class World {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 120)
  readonly sun = new DirectionalLight(0xfff7ef, 2.5)
  readonly focus = new Vector3()
  readonly goal = new Vector3()
  private readonly ground: Mesh
  private readonly camOffset = new Vector3(...VIEW.cameraOffset)
  private readonly sunOffset = new Vector3(...VIEW.sunOffset)

  constructor(readonly container: HTMLElement) {
    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NeutralToneMapping
    renderer.toneMappingExposure = 1
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    container.appendChild(renderer.domElement)
    this.renderer = renderer

    this.scene.add(new HemisphereLight(0xffffff, 0xd2c6b9, 2.1))

    const sun = this.sun
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.radius = 3
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.025
    const sc = sun.shadow.camera
    sc.left = -11
    sc.right = 11
    sc.top = 11
    sc.bottom = -11
    sc.near = 1
    sc.far = 45
    this.scene.add(sun, sun.target)

    this.ground = new Mesh(
      new PlaneGeometry(90, 90),
      new ShadowMaterial({ color: COLORS.shadow, opacity: 0.27, depthWrite: false }),
    )
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.ground.renderOrder = -1
    this.scene.add(this.ground)

    this.resize()
  }

  /** Görünen dünya genişliği ekran oranından bağımsız sabit kalır (oyun her cihazda aynı zorlukta). */
  resize() {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    const aspect = w / h
    // Büyük ekranlarda (tablet, masaüstü) nesneler aşırı büyümesin: en fazla maxPxPerUnit piksel/birim.
    const viewW0 = Math.max(VIEW.width, w / VIEW.maxPxPerUnit)
    const viewH = Math.max(viewW0 / aspect, VIEW.minHeight)
    const viewW = viewH * aspect
    const cam = this.camera
    cam.left = -viewW / 2
    cam.right = viewW / 2
    cam.top = viewH * VIEW.focusFromTop
    cam.bottom = -viewH * (1 - VIEW.focusFromTop)
    cam.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = `${w}px`
    this.renderer.domElement.style.height = `${h}px`
    this.place()
  }

  /** Odağı hemen hedefe taşır (oyun başında). */
  snap() {
    this.focus.copy(this.goal)
    this.place()
  }

  /** Odak hedefe ulaştı mı? (ulaştıysa çizim durdurulabilir) */
  get settled() {
    return this.focus.distanceToSquared(this.goal) < 1e-6
  }

  update(dt: number) {
    if (this.settled) return
    const k = 1 - Math.exp(-dt * VIEW.follow)
    this.focus.lerp(this.goal, k)
    if (this.settled) this.focus.copy(this.goal)
    this.place()
  }

  private place() {
    const f = this.focus
    this.camera.position.copy(f).add(this.camOffset)
    this.camera.lookAt(f)
    this.sun.position.copy(f).add(this.sunOffset)
    this.sun.target.position.copy(f)
    this.sun.target.updateMatrixWorld()
    // Zemin ve gölge kamerası odakla birlikte gider (gölge çözünürlüğü yalnızca görünen alana harcanır).
    this.ground.position.set(Math.round(f.x), 0, Math.round(f.z))
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  /** Dünya noktasının ekran (CSS piksel) konumu */
  toScreen(p: Vector3, out: { x: number; y: number }) {
    const v = TMP.copy(p).project(this.camera)
    out.x = ((v.x + 1) / 2) * this.container.clientWidth
    out.y = ((1 - v.y) / 2) * this.container.clientHeight
    return out
  }

  dispose() {
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

const TMP = new Vector3()
