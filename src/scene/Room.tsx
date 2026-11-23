import { clearHover } from '../interaction/hover'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useStore, findItem } from '../store'
import { focusItem, focusBoardingPasses, closeFocus } from '../interaction/focus'
import { travelTo, travelBack, belongsToView } from '../interaction/travel'
import content from '../content.json'
import { onDoorClick, isDoor, introCtx } from '../interaction/intro'
import { showreel } from '../showreel'
import { scrollToY } from '../smoothScroll'
import { REEL_AT } from '../scrollPlan'

export const MODEL_URL = '/models/room_v10_baked.glb'
const DRACO = '/draco/'

const HIDDEN_ON_LOAD = ['Arcade_Screen', 'Screen_Wide', 'Screen_Vertical', 'Screen_iPad']
/** taken out of the room for good */

/**
 * The photo frame on the desk shows one of the photos from content.json (photo_frame.frame_photo, 1 = first)
 * instead of the placeholder sky baked into the model. The picture lives in one rectangle of the frame's baked texture
 * (u 0.001..0.322, v 0.058..0.499), so that rectangle is repainted with the photo on a sharper copy of the
 * texture. Which way round the picture sits in that rectangle depends on which side of the frame faces the
 * room, so that is worked out from the hero camera.
 */
const PICTURE_UV = { u0: 0.001, u1: 0.322, v0: 0.058, v1: 0.499 }
function usePhotoFramePicture(scene: THREE.Object3D, cameras: THREE.Camera[]) {
  useLayoutEffect(() => {
    const pf = (content as any).photo_frame ?? {}
    const pick = pf.photos?.[Math.max(0, (Number(pf.frame_photo) || 1) - 1)] ?? pf.photos?.[0]
    const src = typeof pick === 'string' ? pick : pick?.src
    const mesh = scene.getObjectByName('BK_photo_frame') as THREE.Mesh | undefined
    const mat = mesh?.material as THREE.MeshBasicMaterial | undefined
    const baked = mat?.map?.image as CanvasImageSource | undefined
    if (!src || !mesh || !mat || !baked) return
    let disposed = false
    let made: THREE.CanvasTexture | null = null
    const old = mat.map!
    const img = new Image()
    img.onload = () => {
      if (disposed) return
      const S = 2048
      const cv = document.createElement('canvas')
      cv.width = cv.height = S
      const g = cv.getContext('2d')!
      g.imageSmoothingQuality = 'high'
      g.drawImage(baked, 0, 0, S, S)
      const x0 = PICTURE_UV.u0 * S, x1 = PICTURE_UV.u1 * S, y0 = PICTURE_UV.v0 * S, y1 = PICTURE_UV.v1 * S
      const w = x1 - x0, h = y1 - y0
      // the frame's front (+z) faces the camera: the picture's top-left lands at the rectangle's bottom-right,
      // a half turn; seen from the back it would only be flipped top to bottom
      const hero = cameras.find((c) => c.name === 'CAM_Hero') ?? cameras[0]
      mesh.updateWorldMatrix(true, false)
      const n = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld)
      const toCam = (hero ? hero.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3()).sub(mesh.getWorldPosition(new THREE.Vector3()))
      const front = n.dot(toCam) >= 0
      g.save()
      g.beginPath()
      g.rect(x0, y0, w, h)
      g.clip()
      g.translate(x0 + w / 2, y0 + h / 2)
      if (front) g.rotate(Math.PI)
      else g.scale(1, -1)
      // cover the rectangle, keeping the photo's proportions
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth * k, dh = img.naturalHeight * k
      g.drawImage(img, -dw / 2, -dh / 2, dw, dh)
      // settle it into the room's baked light a little
      g.fillStyle = 'rgba(20, 8, 4, 0.14)'
      g.fillRect(-w / 2, -h / 2, w, h)
      g.restore()
      made = new THREE.CanvasTexture(cv)
      made.flipY = false
      made.colorSpace = old.colorSpace
      made.anisotropy = 8
      mat.map = made
      mat.needsUpdate = true
    }
    img.src = src
    return () => {
      disposed = true
      if (made) {
        mat.map = old
        mat.needsUpdate = true
        made.dispose()
      }
    }
  }, [scene, cameras])
}

const REMOVED = ['BK_bed']

export function Room() {
  const { scene, cameras } = useGLTF(MODEL_URL, DRACO)
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)

  // one-time setup of the loaded scene
  const items = useMemo(() => {
    const found: THREE.Object3D[] = []
    scene.traverse((o) => {
      if (o.userData?.interactive) {
        o.userData.baseScale = o.scale.clone()
        o.userData.restPos = o.position.clone()
        o.userData.floatAmt = 0
        found.push(o)
      }
      if (HIDDEN_ON_LOAD.includes(o.name) || REMOVED.includes(o.name)) o.visible = false
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh
        const mat = mesh.material as THREE.MeshBasicMaterial
        if (mat?.map) mat.map.anisotropy = 8
        if (o.name === 'Arcade_Logo') {
          const m = mat.clone()
          m.transparent = true
          m.opacity = 0
          m.blending = THREE.AdditiveBlending
          m.depthWrite = false
          mesh.material = m
          mesh.renderOrder = 2
        }
      }
    })
    return found
  }, [scene])

  // use the Blender camera
  useLayoutEffect(() => {
    const cam = (cameras.find((c) => c.name === 'CAM_Hero') ?? cameras[0]) as THREE.PerspectiveCamera
    const doorCam = cameras.find((c) => c.name === 'CAM_Door')
    cam.near = 0.05
    cam.far = 60
    cam.aspect = size.width / size.height
    cam.updateProjectionMatrix()
    // store the hero pose once (effects can run twice in dev, after the camera was moved to the door)
    if (!cam.userData.basePos) {
      cam.userData.baseQuat = cam.quaternion.clone()
      cam.userData.basePos = cam.position.clone()
      cam.userData.baseFov = cam.fov
    }
    // the visit starts in front of the door (human eye height); the hero pose is where we walk to
    scene.updateMatrixWorld(true)
    if (doorCam && useStore.getState().stage !== 'room') {
      cam.userData.doorPos = doorCam.getWorldPosition(new THREE.Vector3())
      cam.userData.doorQuat = doorCam.getWorldQuaternion(new THREE.Quaternion())
      cam.position.copy(cam.userData.doorPos)
      cam.quaternion.copy(cam.userData.doorQuat)
      const dc = doorCam as THREE.PerspectiveCamera
      if (dc.isPerspectiveCamera) {
        cam.fov = dc.fov
        cam.updateProjectionMatrix()
      }
    } else {
      useStore.getState().set({ stage: 'room' })
    }
    introCtx.camera = cam
    introCtx.pivot = scene.getObjectByName('DOOR_Pivot') ?? null
    introCtx.door = scene.getObjectByName('BK_door') ?? null
    set({ camera: cam })
    ;(window as any).__intro = introCtx
    useStore.getState().set({ items, ready: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras, items, set])

  useLayoutEffect(() => {
    const cam = (cameras.find((c) => c.name === 'CAM_Hero') ?? cameras[0]) as THREE.PerspectiveCamera
    cam.aspect = size.width / size.height
    cam.updateProjectionMatrix()
  }, [size, cameras])

  useScreenVideos(scene)
  usePhotoFramePicture(scene, cameras)

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const st = useStore.getState()
    if (st.stage !== 'room') {
      document.body.classList.toggle('hover-cursor', st.stage === 'door' && isDoor(e.intersections[0]?.object))
      return
    }
    if (st.view) {
      // up close on the screens: the ones that lead somewhere light up under the cursor
      const open = st.view.kind === 'screens' && st.view.phase === 'open' && !st.gallery && !st.codeLab
      const hit = open ? findItem(e.intersections[0]?.object) : null
      const link = hit && LINKS.includes(hit.userData.item_id) ? hit : null
      if (link !== st.viewHover) st.set({ viewHover: link })
      return
    }
    if (st.focus) return
    // scrolled down into the sections: the room is behind them, so nothing in it can be hovered
    if (window.scrollY > 24) {
      if (st.hovered) clearHover()
      return
    }
    const item = findItem(e.intersections[0]?.object)
    if (item !== st.hovered) st.set({ hovered: item, dwell: false })
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const st = useStore.getState()
    if (st.stage !== 'room') {
      if (st.stage === 'door' && isDoor(e.intersections[0]?.object)) onDoorClick()
      return
    }
    if (st.focus) {
      if (st.focus.phase !== 'out') closeFocus()
      return
    }
    const item = findItem(e.intersections[0]?.object)
    if (st.view) {
      // up close on the screens, the iPad takes you to the showreel: step back, then glide down to it full screen
      if (st.view.kind === 'screens' && st.view.phase === 'open') {
        const id = item?.userData.item_id
        if (id === 'ipad') return goToShowreel()
        if (id === 'monitor_wide') return openWideScreenLink()
        if (id === 'photo_frame') return openPhotos()
        if (id === 'monitor_vertical') return openCodeLab()
      }
      // clicking the arcade (or one of the screens) keeps you there; anything else takes you back
      if (!belongsToView(item)) travelBack()
      return
    }
    if (!item) return
    if (item.userData.click === 'gather_boarding_passes') {
      const passes = st.items.filter((i) => i.userData.group === 'boarding_passes')
      focusBoardingPasses(passes)
    } else if (item.userData.item_id === 'photo_frame') {
      openPhotos()
    } else if (item.userData.item_id === 'arcade') {
      travelTo('arcade')
    } else if (item.userData.kind === 'screen') {
      travelTo('screens')
    } else {
      focusItem(item)
    }
  }

  return <primitive object={scene} onPointerMove={onMove} onClick={onClick} />
}

/** Up close on the screens, these lead somewhere: the iPad to the showreel, the wide screen to the Framer
 *  site, the photo frame to its photos. */
const LINKS = ['ipad', 'monitor_wide', 'monitor_vertical', 'photo_frame']

function openWideScreenLink() {
  const url = (content as any).screens?.monitor_wide?.link as string | undefined
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function openCodeLab() {
  useStore.getState().set({ hovered: null, viewHover: null, codeLab: true })
}

function openPhotos() {
  useStore.getState().set({ hovered: null, viewHover: null, gallery: true })
}

/** From the screens view: the camera eases back to the room, then the page glides down while the iPad
 *  flies up and its showreel opens to full screen. Slow on purpose, a couple of seconds end to end. */
function goToShowreel() {
  useStore.getState().set({ hovered: null })
  const reduced = useStore.getState().reducedMotion
  travelBack(() => {
    scrollToY(REEL_AT * window.innerHeight, reduced, 3.2)
  })
}

/** Section 2c: play a video on a screen when content.json has a URL for it. */
function useScreenVideos(scene: THREE.Object3D) {
  useLayoutEffect(() => {
    const screens = (content as any).screens ?? {}
    const cleanups: (() => void)[] = []
    scene.traverse((o) => {
      const id = o.userData?.screen_id as string | undefined
      if (!id || !(o as THREE.Mesh).isMesh) return
      // the iPad plays the showreels (shared with the controls); other screens play their own clip
      const reel = id === 'ipad' ? showreel() : null
      const url = screens[id]?.video as string | undefined
      const image = screens[id]?.image as string | undefined
      if (!url && !reel && image) {
        // a still on the screen (the wide monitor shows the Framer site)
        const mesh = o as THREE.Mesh
        const tex = new THREE.TextureLoader().load(image, () => {
          mesh.visible = true
          const start = performance.now()
          const tick = () => {
            const t = Math.min(1, (performance.now() - start) / 600)
            mat.opacity = t
            if (t < 1) requestAnimationFrame(tick)
            else mat.transparent = false
          }
          tick()
        })
        tex.colorSpace = THREE.SRGBColorSpace
        tex.flipY = false
        tex.anisotropy = 8
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 0 })
        mat.color.setScalar(0.78)
        mesh.material = mat
        cleanups.push(() => tex.dispose())
        return
      }
      if (!url && !reel) return
      const video = reel ? reel.video : document.createElement('video')
      if (!reel) Object.assign(video, { src: url, muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous' })
      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.SRGBColorSpace
      // glTF screens use glTF's texture orientation (v runs top-down), so don't flip the video
      tex.flipY = false
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 0 })
      mat.color.setScalar(0.85)
      const mesh = o as THREE.Mesh
      if (reel) mesh.userData.reelMaterial = mat
      mesh.material = mat
      const show = () => {
        mesh.visible = true
        const start = performance.now()
        const tick = () => {
          const t = Math.min(1, (performance.now() - start) / 600)
          mat.opacity = t
          if (t < 1) requestAnimationFrame(tick)
          else mat.transparent = false
        }
        tick()
      }
      if (video.readyState >= 3) show()
      else video.addEventListener('canplay', show, { once: true })
      video.play().catch(() => {})
      if (reel) {
        cleanups.push(() => tex.dispose())
        return
      }
      // only play while the room can be seen: not in a background tab, nor once the sections cover it
      const sync = () => {
        if (document.hidden || useStore.getState().dispersing) video.pause()
        else video.play().catch(() => {})
      }
      document.addEventListener('visibilitychange', sync)
      const unsub = useStore.subscribe((s, prev) => {
        if (s.dispersing !== prev.dispersing) sync()
      })
      cleanups.push(() => {
        unsub()
        document.removeEventListener('visibilitychange', sync)
        video.pause()
        tex.dispose()
      })
    })
    return () => cleanups.forEach((c) => c())
  }, [scene])
}

useGLTF.preload(MODEL_URL, DRACO)
