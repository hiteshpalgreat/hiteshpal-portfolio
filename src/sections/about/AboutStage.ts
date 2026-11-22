import * as THREE from 'three'

/**
 * The 3D part of the About section, after Noomo Labs' "Design to delight" block.
 * The phrases behave like the faces of a turning cube behind Hitesh's photo. Each one rises in from
 * the bottom right, turned about 50 degrees away, straightens as it settles in the middle, holds for
 * a few scrolls, then slides out to the left turning only about 24 degrees. The next phrase is already
 * rising in on the right as the previous one leaves.
 */

const TEXT_H = 1 // height of the lettering (world units)
const ENTER_TURN = THREE.MathUtils.degToRad(50) // how far a phrase is turned when it starts to appear
const EXIT_TURN = THREE.MathUtils.degToRad(80) // how far it has turned when it leaves, like a cube face rolling away
const INK = '#0b0d12'
const TEX_H = 360 // canvas height of each phrase texture
const SQUEEZE = 0.74 // narrows the letters so the bold condensed face reads taller and more elongated

type Face = { mesh: THREE.Mesh; length: number; hover: THREE.Vector2; press: number }

async function phraseTexture(text: string) {
  // Anton: a bold condensed face, drawn narrower still (SQUEEZE) for tall, elongated letters
  const family = `Anton, 'Arial Narrow', sans-serif`
  await Promise.allSettled([document.fonts.load(`400 ${TEX_H}px Anton`)])
  await document.fonts.ready.catch(() => undefined)
  const label = text.toUpperCase()
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = `400 100px ${family}`
  const m = probe.measureText(label)
  const capH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || 72
  // size the type so the capitals fill the strip with a little room above and below
  const size = (100 * TEX_H * 0.9) / capH
  probe.font = `400 ${size}px ${family}`
  const m2 = probe.measureText(label)
  const pad = TEX_H * 0.04
  const c = document.createElement('canvas')
  c.width = Math.ceil(m2.width * SQUEEZE + pad * 2)
  c.height = TEX_H
  const g = c.getContext('2d')!
  g.font = `400 ${size}px ${family}`
  g.fillStyle = INK
  g.textBaseline = 'alphabetic'
  g.translate(pad, 0)
  g.scale(SQUEEZE, 1)
  g.fillText(label, 0, TEX_H * 0.05 + m2.actualBoundingBoxAscent)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { tex, aspect: c.width / c.height }
}

const PHOTO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const PHOTO_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    // soften the bottom edge where the photo is cropped
    c.a *= smoothstep(0.0, 0.12, vUv.y);
    if (c.a < 0.01) discard;
    gl_FragColor = c;
    // back to sRGB for the screen, so the photo keeps the exact colours of the original
    #include <colorspace_fragment>
  }
`

export class AboutStage {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80)
  private block = new THREE.Group()
  private person = new THREE.Group()
  private photo: THREE.Mesh | null = null
  private faces: Face[] = []
  private raf = 0
  private running = false
  private clock = new THREE.Clock()
  private pointer = new THREE.Vector2()
  private look = new THREE.Vector2()
  private disposables: { dispose: () => void }[] = []
  private size = { w: 1, h: 1 }
  private tmp = new THREE.Vector3()
  private aim = new THREE.Vector2()
  private view = { w: 8, h: 5 } // size of the screen at the phrases' depth, in world units
  /** 0..1 through the phrases, set from the scroll */
  progress = 0
  /** 0..1 after the last phrase: it slides out to the left like the others */
  exit = 0

  constructor(canvas: HTMLCanvasElement, opts: { phrases: string[]; photo: string }, private reduced: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.add(this.block, this.person)

    Promise.all(opts.phrases.map(phraseTexture)).then((list) => {
      list.forEach(({ tex, aspect }) => {
        const length = TEXT_H * aspect
        const geo = new THREE.PlaneGeometry(length, TEXT_H)
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.renderOrder = 1 // behind the photo
        mesh.visible = false
        this.block.add(mesh)
        this.faces.push({ mesh, length, hover: new THREE.Vector2(), press: 0 })
        this.disposables.push(geo, mat, tex)
      })
      this.resize(this.size.w, this.size.h)
    })

    new THREE.TextureLoader().load(opts.photo, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const img = tex.image as HTMLImageElement
      const geo = new THREE.PlaneGeometry(img.width / img.height, 1)
      const mat = new THREE.ShaderMaterial({
        vertexShader: PHOTO_VERT,
        fragmentShader: PHOTO_FRAG,
        uniforms: { map: { value: tex } },
        transparent: true,
        depthTest: false,
      })
      this.photo = new THREE.Mesh(geo, mat)
      this.photo.renderOrder = 2 // over the words
      this.person.add(this.photo)
      this.disposables.push(geo, mat, tex)
      this.resize(this.size.w, this.size.h)
    })

    window.addEventListener('pointermove', this.onPointer, { passive: true })
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }

  resize(w: number, h: number) {
    this.size = { w, h }
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    this.camera.aspect = aspect
    const k = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 2 // view height per unit of distance
    // the words take about a third of the screen's height, but back off so the widest phrase fits
    const widest = this.faces.reduce((a, f) => Math.max(a, f.length), 4)
    const share = Math.min(0.42, 0.24 * aspect)
    const d = Math.max(TEXT_H / (share * k), widest / (0.94 * k * aspect))
    // the face in the middle sits at z = 0
    this.camera.position.set(0, 0, d)
    this.camera.updateProjectionMatrix()
    this.view = { w: k * d * aspect, h: k * d }
    // the photo stands on the bottom edge and fills most of the height
    if (this.photo) {
      const viewH = k * d
      const ph = viewH * (aspect < 1 ? 0.7 : 0.9)
      this.photo.scale.setScalar(ph)
      this.photo.position.set(0, -viewH / 2 + ph / 2 - viewH * 0.02, 0)
    }
  }

  setRunning(on: boolean) {
    if (on === this.running) return
    this.running = on
    if (on) {
      this.clock.getDelta()
      this.loop()
    } else cancelAnimationFrame(this.raf)
  }

  /** how far along the phrases we are: -1 = first phrase not in yet, 0 = first phrase in the middle */
  private roll(p: number) {
    const n = Math.max(1, this.faces.length)
    const u = p * n // the first unit brings phrase 0 up from the bottom, each next one rolls on a face
    const i = Math.min(n - 1, Math.floor(u))
    const f = u - i
    // mostly eased, so each phrase settles and holds a moment in the middle
    const s = f * f * (3 - 2 * f)
    return i - 1 + 0.3 * f + 0.7 * s
  }

  private loop = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const dt = Math.min(this.clock.getDelta(), 0.1)
    const t = this.clock.elapsedTime
    const m = this.reduced ? 0 : 1
    // after the last phrase it slides out like the others
    const x = this.exit
    const r = this.roll(this.progress) + x * x * (3 - 2 * x) * 1.05
    const { w: W, h: H } = this.view
    let prevRight = -Infinity // right edge of the phrase that is leaving, so the next one never runs into it
    // the cursor, smoothed (x right, y down, -1..1)
    this.look.lerp(this.pointer, 1 - Math.exp(-dt * 3))
    const ease = 1 - Math.exp(-dt * 6)
    this.faces.forEach((f, i) => {
      const u = r - i // -1: about to appear, 0: settled in the middle, +1: gone off the left
      f.mesh.visible = u > -1 && u < 1
      if (!f.mesh.visible) return
      if (u <= 0) {
        // like Noomo: it comes up from below the frame on the right, turned away, reaches its line in
        // the first ~40% of its entry, then the rest of the scroll only slides it to the middle as it straightens
        const e = 1 + u // 0 = just starting, 1 = settled
        const rise = Math.min(1, e / 0.4)
        const ky = Math.pow(1 - rise, 3) // 1 fully below the frame, 0 on its line
        const reach = W * 0.32 + f.length * 0.5
        // 1 off to the right and turned, 0 centred and square; it trails the leaving phrase with a gap
        const x = Math.max(reach * (1 - e * e * (3 - 2 * e)), prevRight + TEXT_H * 0.35 + f.length * 0.5)
        const kx = Math.min(1, Math.max(0, x / reach))
        f.mesh.position.set(reach * kx, -(H * 0.5 + TEXT_H * 1.1) * ky, -0.6 * kx)
        f.mesh.rotation.set(0.04 * kx, -ENTER_TURN * kx, 0.05 * kx)
        ;(f.mesh.material as THREE.MeshBasicMaterial).opacity = 1
      } else {
        // rolling away to the left like a cube face: it turns up to 60 degrees as it goes
        // eased at both ends, so it glides off and is fully past the left edge before it stops
        const k = u * u * (3 - 2 * u)
        const turn = EXIT_TURN * Math.min(1, u * 1.15) ** 0.8
        f.mesh.position.set(-(W * 0.62 + f.length * 0.62) * k, H * 0.03 * k, -f.length * 0.35 * Math.sin(turn))
        f.mesh.rotation.set(0, turn, -0.03 * k)
        prevRight = f.mesh.position.x + Math.cos(turn) * f.length * 0.5
        // the edge-on sliver dissolves over the last stretch instead of blinking off
        const fade = Math.min(1, Math.max(0, (1 - u) / 0.2))
        ;(f.mesh.material as THREE.MeshBasicMaterial).opacity = fade * fade * (3 - 2 * fade)
      }
      // hover: where the cursor passes over a phrase, that part of it presses back and tips away
      if (m) {
        f.mesh.getWorldPosition(this.tmp).project(this.camera)
        const hw = Math.max(0.15, f.length / W) // half width / height of the phrase on screen (-1..1 units)
        const hh = Math.max(0.12, (TEXT_H / H) * 1.4)
        const dx = (this.look.x - this.tmp.x) / hw
        const dy = (-this.look.y - this.tmp.y) / hh
        const near = Math.exp(-(dx * dx + dy * dy) * 0.5)
        const cx = Math.max(-1, Math.min(1, dx))
        const cy = Math.max(-1, Math.min(1, dy))
        f.hover.lerp(this.aim.set(cx * near, cy * near), ease)
        f.press += (near - f.press) * ease
        f.mesh.rotation.y += f.hover.x * 0.32
        f.mesh.rotation.x -= f.hover.y * 0.28
        f.mesh.position.z -= f.press * 0.25
      }
    })
    // parallax: the words and the photo drift against each other with the cursor, so they read as layers
    this.block.position.set(-this.look.x * W * 0.012 * m, this.look.y * H * 0.012 * m, 0)
    this.person.position.x = this.look.x * W * 0.008 * m
    // the photo turns a touch toward the cursor and breathes
    this.person.rotation.y = this.look.x * 0.07 * m
    this.person.rotation.x = this.look.y * 0.025 * m
    this.person.position.y = Math.sin(t * 0.9) * 0.03 * m - this.look.y * H * 0.006 * m
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.setRunning(false)
    window.removeEventListener('pointermove', this.onPointer)
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }
}
