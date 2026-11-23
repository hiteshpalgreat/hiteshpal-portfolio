import * as THREE from 'three'
import type { WorkCategory } from './workConfig'

/**
 * The 3D part of the Work section: one spiral of cards per category, laid along the
 * camera's path. Scrolling flies the camera forward; each spiral first sits as a ring
 * around the title, then its cards stream past, then the next spiral grows out of the dark.
 *
 * Light by design: one small texture atlas per category for the placeholders (real images
 * load one by one only when given), plain unlit materials, no post-processing, and it
 * only renders while the section is on screen.
 */

const CELL = 192 // placeholder resolution (px per atlas cell)
const HOLD_DIST = 2.3 // camera distance in front of a spiral when its title is shown
const GAP = 5 // empty space between two spirals
const TURN = 0.62 // radians between neighbouring cards (about 10 cards per turn)
const APPROACH = 3.2 // the spiral starts filling in this far before its title is reached
const RADIUS = 0.82 // circular spiral radius

/** a card that plays a muted, looping clip while it's on screen (poster image until then) */
type VideoSlot = {
  url: string
  mat: THREE.MeshBasicMaterial
  el: HTMLVideoElement | null
  tex: THREE.VideoTexture | null
  playing: boolean
  /** the still shown before (and, on phones, again after) the clip plays */
  poster: THREE.Texture | null
}

/**
 * Phones (iPhones above all) have far less memory for a web page: there the spiral keeps every image
 * small, plays only a few clips at once and lets go of each clip as soon as it leaves the screen.
 * Without this the 130-odd full-size images alone come to several hundred MB and iOS closes the page.
 */
const LOW_MEM =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600)

/** at most this many clips play at once; the rest wait on their poster */
const MAX_PLAYING = LOW_MEM ? 3 : 10
/** longest side of a card image on the GPU: about what a card ever covers on screen */
const MAX_IMAGE = LOW_MEM ? 420 : 960

/** Scale an image down to at most `max` px on its longest side (images already small enough pass through). */
function shrink(img: HTMLImageElement, max: number): HTMLImageElement | HTMLCanvasElement {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const k = max / Math.max(w, h)
  if (k >= 1) return img
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * k))
  c.height = Math.max(1, Math.round(h * k))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, c.width, c.height)
  return c
}

type Card = {
  video?: VideoSlot
  mesh: THREE.Mesh
  baseZ: number
  phase: number
  tilt: number
  cat: number
  /** 0..1 position in its spiral: cards appear in this order */
  order: number
  w: number
  h: number
}

export type Stop = {
  /** camera z where this spiral starts to fill in, card by card */
  approachZ: number
  /** camera z where this category's title is shown */
  holdZ: number
  /** camera z once its last card has passed */
  endZ: number
}

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Draw all placeholders of a category into one atlas canvas. */
function buildAtlas(cat: WorkCategory, ratios: number[]) {
  const cols = Math.ceil(Math.sqrt(cat.count))
  const rows = Math.ceil(cat.count / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cols * CELL
  canvas.height = rows * CELL
  const g = canvas.getContext('2d')!
  const [a, b] = [hexToRgb(cat.tint[0]), hexToRgb(cat.tint[1])]
  const uv: { u: number; v: number; w: number; h: number }[] = []
  for (let i = 0; i < cat.count; i++) {
    const r = ratios[i]
    const cx = (i % cols) * CELL
    const cy = Math.floor(i / cols) * CELL
    const pad = 4
    let w = CELL - pad * 2
    let h = w / r
    if (h > CELL - pad * 2) {
      h = CELL - pad * 2
      w = h * r
    }
    const x = cx + (CELL - w) / 2
    const y = cy + (CELL - h) / 2
    // gradient card, slightly different per index
    const t = (i * 0.37) % 1
    const grad = g.createLinearGradient(x, y, x + w, y + h)
    const mix = (k: number) => a.map((c, j) => Math.round(c + (b[j] - c) * k))
    const navy = [44, 11, 23] // the wine of the background
    const mute = (c: number[], k: number) => c.map((v, j) => Math.round(v * (1 - k) + navy[j] * k))
    const c1 = mute(mix(0.1 + t * 0.3), 0.35)
    const c2 = mute(mix(0.7 + t * 0.3), 0.55)
    grad.addColorStop(0, `rgb(${c1.join(',')})`)
    grad.addColorStop(1, `rgb(${c2.join(',')})`)
    g.save()
    g.beginPath()
    g.roundRect(x, y, w, h, Math.min(w, h) * 0.04)
    g.fillStyle = grad
    g.fill()
    g.clip()
    // while the real image is on its way: just a soft lit card, no numbers or labels, so it reads as
    // loading rather than as an empty slot
    const glow = g.createRadialGradient(x + w * 0.25, y + h * 0.2, 0, x + w * 0.25, y + h * 0.2, Math.max(w, h))
    glow.addColorStop(0, 'rgba(255,255,255,0.22)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = glow
    g.fillRect(x, y, w, h)
    g.restore()
    uv.push({ u: x / canvas.width, v: 1 - (y + h) / canvas.height, w: w / canvas.width, h: h / canvas.height })
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, uv }
}

/** Small deterministic random so the layout is the same on every visit. */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export class WorkSpiral {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 40)
  private world = new THREE.Group()
  private cards: Card[] = []
  private raf = 0
  private running = false
  private clock = new THREE.Clock()
  private camZ = 0
  private pointer = new THREE.Vector2()
  private pointerSmooth = new THREE.Vector2()
  private disposables: { dispose: () => void }[] = []
  readonly stops: Stop[] = []
  /** real images waiting to replace their placeholders */
  private pending: { src: string; mat: THREE.MeshBasicMaterial }[] = []
  private loading = false
  private videos: VideoSlot[] = []
  readonly startZ: number

  constructor(private canvas: HTMLCanvasElement, categories: WorkCategory[], private reduced: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_MEM ? 1.5 : 1.75))
    this.renderer.setClearColor(0x000000, 0)
    this.scene.add(this.world)

    const geo = new THREE.PlaneGeometry(1, 1)
    this.disposables.push(geo)
    let z = 0
    categories.forEach((cat, ci) => {
      const ratios = Array.from({ length: cat.count }, (_, i) => cat.items?.[i]?.ratio ?? cat.ratios[i % cat.ratios.length])
      const { tex, uv } = buildAtlas(cat, ratios)
      this.disposables.push(tex)
      // denser spirals for the big category, roomier for the small ones
      const dz = cat.count > 40 ? 0.11 : cat.count > 16 ? 0.16 : 0.22
      const size = cat.count > 40 ? 0.3 : 0.38
      const startAngle = ci * 1.3
      for (let i = 0; i < cat.count; i++) {
        const r = ratios[i]
        const item = cat.items?.[i]
        // every card starts as its placeholder; real images swap in once the section gets near (loadImages)
        const map = tex.clone()
        map.offset.set(uv[i].u, uv[i].v)
        map.repeat.set(uv[i].w, uv[i].h)
        const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide })
        this.disposables.push(mat, map)
        if (item?.src) this.pending.push({ src: item.src, mat })
        const video: VideoSlot | undefined = item?.video
          ? { url: item.video, mat, el: null, tex: null, playing: false, poster: null }
          : undefined
        if (video) this.videos.push(video)
        const mesh = new THREE.Mesh(geo, mat)
        // card size: longest side = size
        const w = r >= 1 ? size * Math.min(r, 1.6) * 0.85 : size * r
        const h = r >= 1 ? (size * Math.min(r, 1.6) * 0.85) / r : size
        mesh.scale.set(w, h, 1)
        mesh.visible = false
        const a = startAngle + i * TURN + (rand(ci * 100 + i) - 0.5) * 0.25
        const rad = RADIUS * (1 + (rand(ci * 100 + i + 50) - 0.5) * 0.2)
        const baseZ = z - i * dz
        // a circular spiral around the title
        mesh.position.set(Math.cos(a) * rad, Math.sin(a) * rad, baseZ)
        // mostly facing the viewer, gently tilted, a slight turn toward the centre
        mesh.rotation.set((rand(i * 3 + ci) - 0.5) * 0.3 + Math.sin(a) * 0.18, -Math.cos(a) * 0.32, 0)
        mesh.userData.href = item?.href
        this.world.add(mesh)
        this.cards.push({ video, mesh, baseZ, phase: rand(i + ci * 9) * Math.PI * 2, tilt: (rand(i * 7 + ci) - 0.5) * 0.5, cat: ci, order: i / cat.count, w, h })
      }
      const depth = cat.count * dz
      this.stops.push({ approachZ: z + HOLD_DIST + APPROACH, holdZ: z + HOLD_DIST, endZ: z - depth - 0.6 })
      z = z - depth - GAP
    })
    this.startZ = this.stops[0].approachZ
    this.camZ = this.startZ
    window.addEventListener('pointermove', this.onPointer, { passive: true })
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // keep the ring framed the same way on narrow screens
    this.camera.fov = w / h < 1 ? 60 : 45
    this.camera.updateProjectionMatrix()
  }

  setCameraZ(z: number) {
    this.camZ = z
  }

  /** Load the real images (a few at a time, in spiral order) and swap them in as each arrives. */
  loadImages() {
    if (this.loading) return
    this.loading = true
    const loader = new THREE.ImageLoader()
    loader.setCrossOrigin('anonymous')
    const queue = this.pending.slice()
    const next = () => {
      const job = queue.shift()
      if (!job) return
      loader.load(
        job.src,
        (img) => {
          // stored at card size, without mipmaps: a fraction of the memory of the full image
          const t = new THREE.Texture(shrink(img, MAX_IMAGE))
          t.colorSpace = THREE.SRGBColorSpace
          t.generateMipmaps = false
          t.minFilter = THREE.LinearFilter
          t.needsUpdate = true
          const old = job.mat.map
          const slot = this.videos.find((x) => x.mat === job.mat)
          if (slot && old instanceof THREE.VideoTexture) {
            // its clip is already playing: this image becomes the still it returns to
            slot.poster = t
          } else {
            job.mat.map = t
            job.mat.needsUpdate = true
            // the placeholder clone isn't needed any more
            if (old && old !== t) old.dispose()
          }
          this.disposables.push(t)
          next()
        },
        undefined,
        () => next(), // a missing file keeps its soft placeholder card
      )
    }
    // several downloads at once, so the cards fill in quickly on a real connection
    for (let k = 0; k < (LOW_MEM ? 4 : 8); k++) next()
  }

  /** play a card's clip while it's clearly on screen, pause it otherwise */
  private syncVideo(v: VideoSlot, want: boolean) {
    if (this.reduced || !this.loading) return // reduced motion: posters only; nothing streams until the section is near
    if (want && !v.playing) {
      if (this.videos.filter((x) => x.playing).length >= MAX_PLAYING) return
      if (!v.el) {
        const el = document.createElement('video')
        Object.assign(el, { muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' })
        el.setAttribute('playsinline', '')
        el.src = v.url
        const tex = new THREE.VideoTexture(el)
        tex.colorSpace = THREE.SRGBColorSpace
        // keep showing the poster until real frames arrive
        el.addEventListener(
          'playing',
          () => {
            if (v.el !== el) return // already let go of
            if (v.mat.map !== tex) v.poster = v.mat.map
            v.mat.map = tex
            v.mat.needsUpdate = true
          },
          { once: true },
        )
        v.el = el
        v.tex = tex
      }
      v.playing = true
      v.el.play().catch(() => (v.playing = false))
    } else if (!want && v.playing) {
      v.playing = false
      v.el?.pause()
      if (LOW_MEM) this.releaseVideo(v)
    }
  }

  /** Back to the poster and free the clip's decoder and frame memory (phones). */
  private releaseVideo(v: VideoSlot) {
    if (v.poster && v.mat.map !== v.poster) {
      v.mat.map = v.poster
      v.mat.needsUpdate = true
    }
    if (v.el) {
      v.el.pause()
      v.el.removeAttribute('src')
      v.el.load()
    }
    v.tex?.dispose()
    v.el = null
    v.tex = null
  }

  private stopVideos() {
    for (const v of this.videos) {
      v.playing = false
      v.el?.pause()
      if (LOW_MEM) this.releaseVideo(v)
    }
  }

  setRunning(on: boolean) {
    if (on === this.running) return
    this.running = on
    if (on) {
      this.clock.getDelta()
      this.loop()
    } else {
      cancelAnimationFrame(this.raf)
      this.stopVideos() // off screen: no clip keeps playing
    }
  }

  private loop = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const dt = Math.min(this.clock.getDelta(), 0.1)
    const t = this.clock.elapsedTime
    // camera glides toward its scroll position; a touch of cursor parallax
    this.camera.position.z += (this.camZ - this.camera.position.z) * (1 - Math.exp(-dt * 10))
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3))
    const par = this.reduced ? 0 : 0.06
    this.camera.position.x = this.pointerSmooth.x * par
    this.camera.position.y = -this.pointerSmooth.y * par
    this.camera.lookAt(this.camera.position.x * 0.5, this.camera.position.y * 0.5, this.camera.position.z - 3)
    // the whole spiral turns as you travel, so the cards swirl past
    this.world.rotation.z = (this.startZ - this.camera.position.z) * 0.16 + (this.reduced ? 0 : t * 0.015)
    const cz = this.camera.position.z
    // how far each spiral has filled in: 0 when the camera is at its approach point, 1 at its title
    const fill = this.stops.map((st) => THREE.MathUtils.clamp((st.approachZ - cz) / (st.approachZ - st.holdZ), 0, 1))
    for (const c of this.cards) {
      const d = cz - c.baseZ // distance in front of the camera
      const mat = c.mesh.material as THREE.MeshBasicMaterial
      // fade in from the dark far away, fade out just before passing the camera
      const near = THREE.MathUtils.smoothstep(d, 0.12, 0.7)
      const far = 1 - THREE.MathUtils.smoothstep(d, 4.2, 7.5)
      // cards pop in one after another along the spiral, from the first to the last
      const pop = THREE.MathUtils.smoothstep(fill[c.cat], c.order * 0.88, c.order * 0.88 + 0.12)
      const o = near * far * pop
      mat.opacity = o
      const k = 0.55 + 0.45 * pop
      c.mesh.scale.set(c.w * k, c.h * k, 1)
      c.mesh.visible = o > 0.004
      if (c.video) this.syncVideo(c.video, o > 0.2)
      if (!this.reduced) c.mesh.position.z = c.baseZ + Math.sin(t * 0.6 + c.phase) * 0.02
      // positions swirl with the spiral, but each card stays (almost) upright
      c.mesh.rotation.z = -this.world.rotation.z + c.tilt
    }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.setRunning(false)
    for (const v of this.videos) {
      v.el?.pause()
      v.el?.removeAttribute('src')
      v.el?.load()
      v.tex?.dispose()
    }
    window.removeEventListener('pointermove', this.onPointer)
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }
}
