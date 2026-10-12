"use client"

import * as React from "react"
import Link from "next/link"
import { useLenis } from "lenis/react"
import { ANALYTES, mixHex, type AnalyteDef } from "@/lib/analytes"
import { useStage } from "./smooth-scroll"
import { markReady } from "./film-intro"

/**
 * VITRA specimen — the landing homescreen.
 *
 * Adapted from "Lycoris Specimen" by kedhareswer (21st.dev/@kedhareswer,
 * github.com/kedhareswer/21stdev-my-components): a scroll-scrubbed specimen
 * built around one procedurally modelled flower, lit in raw WebGL, with one
 * continuous camera move across six pinned frames.
 *
 * VITRA changes: the chrome lily is drawn as glass (vitrum) — fresnel rims,
 * a cool studio reflection, additive transparency — and its stamen tips carry
 * the ten reagent-pad colours (synthetic demo ramps). The stage is transparent
 * so the live silk background shows through. The type is Instrument Serif
 * with mono slates; the six frames tell the KJS-HC-03 story, and the glyph
 * specimen became an analyte specimen.
 */

// #region strip
type V3 = [number, number, number]

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

const toLinear = (hex: string): V3 => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.pow(v / 255, 2.2)
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)]
}
/**
 * Each pad as a jewel tone: the deep end of its synthetic demo ramp, warmed
 * with champagne so the ten sit together on emerald and gold. Decorative —
 * an illustration of the strip, never a measurement.
 */
const jewel = (a: AnalyteDef) => mixHex(a.demoRamp[2], "#ebdab0", 0.28)
const PAD_LIN: V3[] = ANALYTES.map((a) => toLinear(jewel(a)))

/** Where the camera looks: the centre of the colour cube. */
const HEART: V3 = [0, 0.25, 0]

/** Interleaved vertex layout: pos 3, normal 3, aux 4 (s, index, kind, stagger), base 3, colour 3. */
const STRIDE = 16
const NO_COL: V3 = [-1, -1, -1]
/** Edge length of the RGB cube in model units. */
const SIDE = 3

const rgbOf = (hex: string): V3 => {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
/** A colour's place in the cube: R along x, G along y, B along z. */
const at = (rgb: V3): V3 => [HEART[0] + (rgb[0] - 0.5) * SIDE, HEART[1] + (rgb[1] - 0.5) * SIDE, HEART[2] + (rgb[2] - 0.5) * SIDE]

/**
 * Colorimetry, drawn: an RGB colour cube in smoked glass with gold edges, and
 * the ten reagent pads inside it as glowing orbs. Each orb sits where its
 * colour sits in RGB space and travels, as the reaction develops, from the
 * pale end of its synthetic demo ramp to the deep end. Kind 0 is an orb,
 * 3 the glass cube, 4 a gold edge.
 */
const buildColourSpace = () => {
  const v: number[] = []
  const idx: number[] = []
  let count = 0
  const push = (p: V3, n: V3, kind: number, index: number, stagger: number, base: V3, col: V3) => {
    v.push(p[0], p[1], p[2], n[0], n[1], n[2], 0, index, kind, stagger, base[0], base[1], base[2], col[0], col[1], col[2])
    return count++
  }
  const zero: V3 = [0, 0, 0]
  const box = (c: V3, h: V3, kind: number) => {
    for (let a = 0; a < 3; a++) {
      for (const sg of [-1, 1]) {
        const n: V3 = [0, 0, 0]
        n[a] = sg
        const b = (a + 1) % 3
        const d = (a + 2) % 3
        const start = count
        for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const p: V3 = [c[0], c[1], c[2]]
          p[a] += sg * h[a]
          p[b] += u * h[b]
          p[d] += w * h[d]
          push(p, n, kind, 0, 0, zero, NO_COL)
        }
        idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
      }
    }
  }
  const H = SIDE / 2
  // the glass volume
  box(HEART, [H, H, H], 3)
  // twelve gold edges
  const T = 0.016
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3
    const d = (a + 2) % 3
    for (const sb of [-1, 1])
      for (const sd of [-1, 1]) {
        const c: V3 = [HEART[0], HEART[1], HEART[2]]
        c[b] += sb * H
        c[d] += sd * H
        const h: V3 = [T, T, T]
        h[a] = H + T
        box(c, h, 4)
      }
  }
  // ten orbs, one per pad
  const LAT = 10
  const LON = 16
  const R = 0.2
  ANALYTES.forEach((a, i) => {
    const end = at(rgbOf(a.demoRamp[2]))
    const start = at(rgbOf(a.demoRamp[0]))
    const off = sub(start, end)
    const col = PAD_LIN[i]
    const first = count
    for (let la = 0; la <= LAT; la++) {
      const th = (la / LAT) * Math.PI
      for (let lo = 0; lo <= LON; lo++) {
        const ph = (lo / LON) * Math.PI * 2
        const n: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]
        push(add(end, mul(n, R)), n, 0, i, i / ANALYTES.length, off, col)
      }
    }
    for (let la = 0; la < LAT; la++)
      for (let lo = 0; lo < LON; lo++) {
        const p0 = first + la * (LON + 1) + lo
        const p1 = p0 + LON + 1
        idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1)
      }
  })
  const radius = Math.sqrt(3) * H
  return { data: new Float32Array(v), index: new Uint16Array(idx), vertices: count, radius }
}
// #endregion

// #region scroll
const clamp01 = (x: number) => (x <= 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** 0 while the root's top sits at the stage's top, 1 when its bottom does. */
const progressFrom = (top: number, height: number, viewport: number) => {
  const travel = height - viewport
  if (travel <= 0) return 0
  return clamp01(-top / travel)
}

/**
 * Scroll progress → a continuous frame coordinate in 0..n-1. Integers are the
 * frames; each one holds for `hold` of its slot so the layout can be read
 * before the next morph starts.
 */
const sceneCoord = (p: number, n: number, hold: number) => {
  if (n <= 1) return 0
  const t = clamp01(p) * (n - 1)
  const i = Math.min(Math.floor(t), n - 2)
  const h = hold / 2
  return i + easeInOut(clamp01((t - i - h) / (1 - 2 * h)))
}

/**
 * How present one element of frame `scene` is at `coord`. `delay` 0..1 staggers
 * it: late on the way in, and — mirrored — late on the way out.
 */
const reveal = (coord: number, scene: number, delay: number) => {
  const d = coord - scene
  const lag = d < 0 ? delay : 1 - delay
  return clamp01((0.6 - Math.abs(d) - lag * 0.2) / 0.25)
}
// #endregion

// ---- camera frames -------------------------------------------------------

type Key = {
  /** turn of the flower about its stem, radians */
  spin: number
  /** camera elevation, degrees; +90 looks straight down */
  el: number
  /** flower radius as a fraction of the stage's short side */
  size: number
  /** where the heart lands, in clip space (-1..1, +y up) */
  ox: number
  oy: number
  /** how much of the scape is drawn; below the flower it is in the way */
  stem: number
}

const KEYS: Key[] = [
  { spin: 0.65, el: 20, size: 0.6, ox: 0, oy: -0.02, stem: 1 },
  { spin: 1.35, el: 52, size: 0.5, ox: 0, oy: -0.04, stem: 1 },
  { spin: 2.0, el: 18, size: 0.26, ox: 0, oy: 0.36, stem: 1 },
  { spin: 2.6, el: -22, size: 0.62, ox: 0, oy: -0.32, stem: 1 },
  { spin: 3.4, el: 26, size: 0.86, ox: 0.6, oy: 0.04, stem: 1 },
  { spin: 4.2, el: -30, size: 0.66, ox: 0, oy: 0.92, stem: 1 },
]
// Portrait stages move the flower rather than squeezing the type.
const KEYS_TALL: Partial<Key>[] = [
  { size: 0.9, oy: 0.36 },
  { size: 0.56 },
  { size: 0.34, oy: 0.44 },
  { size: 0.95, oy: -0.2 },
  { size: 0.86, ox: 0.5, oy: 0.46 },
  { size: 0.96, oy: 1.0 },
]
const SCENES = KEYS.length
const HOLD = 0.34

const keyAt = (coord: number, tall: boolean): Key => {
  const i = Math.max(0, Math.min(SCENES - 1, Math.floor(coord)))
  const j = Math.min(SCENES - 1, i + 1)
  const f = coord - i
  const a = { ...KEYS[i], ...(tall ? KEYS_TALL[i] : {}) }
  const b = { ...KEYS[j], ...(tall ? KEYS_TALL[j] : {}) }
  const l = (x: number, y: number) => x + (y - x) * f
  return {
    spin: l(a.spin, b.spin), el: l(a.el, b.el), size: l(a.size, b.size),
    ox: l(a.ox, b.ox), oy: l(a.oy, b.oy), stem: l(a.stem, b.stem),
  }
}

// ---- matrices (column-major) ----------------------------------------------

type M4 = Float32Array
const perspective = (fovy: number, aspect: number, near: number, far: number): M4 => {
  const f = 1 / Math.tan(fovy / 2)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}
const lookAt = (eye: V3, at: V3): M4 => {
  const z = norm(sub(eye, at))
  const x = norm(cross([0, 1, 0], z))
  const y = cross(z, x)
  const m = new Float32Array(16)
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2]
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2]
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]
  m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye); m[15] = 1
  return m
}
const multiply = (a: M4, b: M4): M4 => {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
  return o
}
const rotY = (t: number): M4 => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1])
}
const rotX = (t: number): M4 => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1])
}

const hexToLinear = (hex: string): V3 => {
  let h = hex.replace("#", "").trim()
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0.8, 0.02, 0.03]
  const ch = (v: number) => Math.pow(v / 255, 2.2)
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)]
}

// ---- shaders --------------------------------------------------------------

const VERT = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec4 a_aux;
attribute vec3 a_base;
attribute vec3 a_col;
varying vec3 v_col;
uniform mat4 u_vp;
uniform mat4 u_model;
uniform vec2 u_offset;
uniform float u_time;
uniform float u_bloom;
uniform float u_sway;
uniform float u_stem;
varying vec3 v_n;
varying vec3 v_w;
varying float v_s;
varying float v_stag;
varying float v_kind;
varying float v_idx;
void main() {
  vec3 p = a_pos;
  v_stag = a_aux.w;
  v_kind = a_aux.z;
  v_idx = a_aux.y;
  float k = a_aux.z;
  if (k < 0.5) {
    // an orb travels from its undeveloped colour to its developed one
    float dev = clamp(u_bloom * 1.5 - a_aux.w * 0.5, 0.0, 1.0);
    dev = dev * dev * (3.0 - 2.0 * dev);
    p = a_pos + a_base * (1.0 - dev);
    p += 0.03 * u_sway * vec3(sin(u_time * 0.9 + a_aux.y), sin(u_time * 1.1 + a_aux.y * 1.7), cos(u_time * 0.8 + a_aux.y * 1.3));
  }
  vec4 w = u_model * vec4(p, 1.0);
  v_w = w.xyz;
  v_n = (u_model * vec4(a_nrm, 0.0)).xyz;
  v_s = a_aux.x;
  v_col = a_col;
  gl_Position = u_vp * w;
  gl_Position.xy += u_offset * gl_Position.w;
}
`

// Glass: a faint tinted body, rims that split into a slight spectrum where
// the surface turns away (per-channel fresnel), and the same dark studio —
// overhead softbox, side strip, back rim — reflected in cool white. Drawn
// additively without depth writes, so crossing petals stack like real glass.
// Stamen tips glow in the ten reagent colours.
const FRAG = `
precision highp float;
uniform vec3 u_eye;
uniform vec3 u_red;
uniform vec3 u_hot;
uniform float u_alpha;
uniform float u_hi;
uniform float u_bloom;
varying vec3 v_n;
varying vec3 v_w;
varying float v_s;
varying vec3 v_col;
varying float v_stag;
varying float v_kind;
varying float v_idx;
float studio(vec3 r) {
  float key = pow(max(dot(r, normalize(vec3(-0.45, 0.85, 0.35))), 0.0), 14.0) * 2.6;
  float strip = smoothstep(0.55, 0.8, r.x) * smoothstep(-0.7, 0.3, r.y) * 1.4;
  float rim = smoothstep(0.55, 0.95, -r.z) * smoothstep(-0.2, 0.5, r.y) * 0.9;
  float hz = exp(-abs(r.y - 0.05) * 7.0) * 0.4;
  return key + strip + rim + hz;
}
void main() {
  vec3 n = normalize(v_n);
  vec3 v = normalize(u_eye - v_w);
  if (dot(n, v) < 0.0) n = -n;
  vec3 r = reflect(-v, n);
  float e = studio(r);
  float ndv = max(dot(n, v), 0.0);
  float fr = pow(1.0 - ndv, 2.6);
  vec3 disp = vec3(pow(1.0 - ndv, 2.1), pow(1.0 - ndv, 2.6), pow(1.0 - ndv, 3.2));
  vec3 col = u_red * 0.05 + vec3(0.05, 0.045, 0.03);
  col += disp * mix(u_red, vec3(1.0), 0.5) * 1.5;
  col += vec3(0.86, 0.95, 1.0) * e * (0.22 + 0.78 * fr);
  col += u_hot * pow(e, 3.0) * 0.28;
  float a = clamp(0.1 + fr * 0.85 + e * 0.3, 0.0, 1.0);
  if (v_kind > 3.5) {
    // gold edge: brushed metal catching the studio
    vec3 gold = vec3(0.58, 0.4, 0.17);
    col = gold * (0.3 + 0.6 * ndv) + gold * e * 1.5 + vec3(1.0, 0.9, 0.7) * pow(e, 3.0) * 0.3;
    a = 0.95;
  } else if (v_col.r >= 0.0) {
    // an orb: pale while undeveloped, deepening to its jewel tone; the hovered pad burns brighter
    float dev = clamp(u_bloom * 1.5 - v_stag * 0.5, 0.0, 1.0);
    vec3 orb = mix(vec3(0.55, 0.53, 0.48), v_col * 2.2, dev);
    float hi = u_hi < 0.0 ? 1.0 : (abs(v_idx - u_hi) < 0.5 ? 1.9 : 0.3);
    col = orb * (0.6 + 0.8 * ndv) * hi + e * 0.3 + vec3(0.92, 0.82, 0.6) * fr * 0.9;
    a = 0.97;
  }
  col = col / (1.0 + col);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col * a * u_alpha, a * u_alpha);
}
`

// ---- copy ------------------------------------------------------------------

const DISPLAY = 'var(--font-serif), "Instrument Serif", "Iowan Old Style", Georgia, serif'
const MONO = 'var(--font-mono), "JetBrains Mono", ui-monospace, monospace'

const NAV = ["Cover", "Reaction", "Analytes", "Instrument", "Signal", "Console"]

const SPECS = [
  "Raspberry Pi 5 · Pi camera",
  "Opaque enclosure · regulated LEDs",
  "120 s timed reaction",
  "10 pads → 30-D RGB vector",
  "A clinician reviews every run",
]

const TAGLINE = [
  { text: "Colour" },
  { text: "becomes", small: true },
  { text: "data" },
  { text: "in 120 seconds", small: true },
]

const SUB = "₀₁₂₃₄₅₆₇₈₉"
const subscript = (n: number) => String(n).split("").map((d) => SUB[Number(d)]).join("")

// Scoped by the lys- prefix.
const CSS =
  ".lys-stage{container-type:size;container-name:lys}" +
  ".lys-char{display:inline-block;animation:lys-in 1.5s cubic-bezier(.2,.8,.2,1) both}" +
  ".vts:not([data-play]) .lys-char{animation-play-state:paused}" +
  "@keyframes lys-in{from{opacity:0;transform:translateY(0.35em) rotate(4deg);filter:blur(14px)}to{opacity:1;transform:none;filter:blur(0)}}" +
  ".lys-g{display:inline-block;transition:color .25s,transform .35s cubic-bezier(.2,.8,.2,1);cursor:default}" +
  ".lys-g:hover{color:var(--lys-red);transform:translateX(0.08em)}" +
  ".lys-nav button{display:flex;align-items:center;gap:10px;justify-content:flex-end;background:none;border:0;padding:5px 0;cursor:pointer;color:inherit;font:inherit}" +
  ".lys-nav .lys-tick{display:block;height:1px;width:14px;background:currentColor;opacity:.45;transition:width .4s cubic-bezier(.2,.8,.2,1),opacity .3s,background-color .3s}" +
  ".lys-nav .lys-lab{opacity:0;transform:translateX(6px);transition:opacity .3s,transform .3s}" +
  ".lys-nav button:hover .lys-lab,.lys-nav button:focus-visible .lys-lab{opacity:1;transform:none}" +
  ".lys-nav button[aria-current=step] .lys-tick{width:34px;opacity:1;background:var(--lys-red)}" +
  ".lys-link{color:inherit;text-decoration:none;transition:color .3s}.lys-link:hover{color:var(--lys-red)}" +
  "@media (prefers-reduced-motion: reduce){.lys-char{animation:none}.lys-g{transition:none}}"

type Fx = "rise" | "clip" | "line" | "fade" | "draw"

/** Everything that belongs to one frame registers itself through this. */
const sc = (scene: number, fx: Fx = "rise", delay = 0) => ({
  "data-sc": scene,
  "data-fx": fx,
  "data-d": delay,
})

export type VitraSpecimenProps = {
  ink?: string
  /** The type colour: cream, deliberately not white. */
  bone?: string
  /** Type accents (amber — never a result colour). */
  crimson?: string
  /** The glass. */
  tint?: string
  height?: string
  sceneScroll?: number
  florets?: number
  seed?: number
  alive?: boolean
  className?: string
}

export default function VitraSpecimen({
  bone = "#f2ebdd",
  crimson = "#c9a96e",
  tint = "#d9e4dc",
  height = "100vh",
  sceneScroll = 1.15,
  florets = 6,
  seed = 7,
  alive = true,
  className = "",
}: VitraSpecimenProps) {
  const name = "VITRA"
  const { introDone } = useStage()
  const rootRef = React.useRef<HTMLElement | null>(null)
  const stageRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const glowRef = React.useRef<HTMLDivElement | null>(null)
  const wordRef = React.useRef<HTMLDivElement | null>(null)
  const [reduced, setReduced] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [inspect, setInspect] = React.useState<AnalyteDef | null>(null)

  const letters = Array.from(name)
  const firstIdx = 0
  const lastIdx = letters.length - 1

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const bornAt = React.useRef<number | null>(null)
  if (introDone && bornAt.current == null && typeof performance !== "undefined") bornAt.current = performance.now()
  /** Index of the hovered analyte, read by the render loop to light its orb. */
  const hiRef = React.useRef(-1)
  hiRef.current = inspect ? ANALYTES.findIndex((a) => a.key === inspect.key) : -1
  const look = React.useRef({ crimson, tint, alive, reduced, florets, seed, bornAt: bornAt.current })
  look.current = { crimson, tint, alive, reduced, florets, seed, bornAt: bornAt.current }

  React.useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const canvas = canvasRef.current
    const glow = glowRef.current
    const word = wordRef.current
    if (!root || !stage || !canvas || !glow || !word) return

    const mesh = buildColourSpace()
    const radius = mesh.radius

    // ---- GL, with a 2D fallback -------------------------------------------
    let gl: WebGLRenderingContext | null = null
    let ctx2d: CanvasRenderingContext2D | null = null
    let prog: WebGLProgram | null = null
    let vbo: WebGLBuffer | null = null
    let ibo: WebGLBuffer | null = null
    const loc: Record<string, WebGLUniformLocation | null> = {}

    const initGL = () => {
      gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true }) as WebGLRenderingContext | null
      if (!gl) return false
      const compile = (type: number, src: string) => {
        const sh = gl!.createShader(type)!
        gl!.shaderSource(sh, src)
        gl!.compileShader(sh)
        return gl!.getShaderParameter(sh, gl!.COMPILE_STATUS) ? sh : null
      }
      const vs = compile(gl.VERTEX_SHADER, VERT)
      const fs = compile(gl.FRAGMENT_SHADER, FRAG)
      if (!vs || !fs) return false
      prog = gl.createProgram()!
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
      gl.useProgram(prog)
      vbo = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW)
      ibo = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW)
      const attr = (n: string, size: number, off: number) => {
        const a = gl!.getAttribLocation(prog!, n)
        if (a < 0) return
        gl!.enableVertexAttribArray(a)
        gl!.vertexAttribPointer(a, size, gl!.FLOAT, false, STRIDE * 4, off * 4)
      }
      attr("a_pos", 3, 0)
      attr("a_nrm", 3, 3)
      attr("a_aux", 4, 6)
      attr("a_base", 3, 10)
      attr("a_col", 3, 13)
      for (const n of ["u_vp", "u_model", "u_offset", "u_time", "u_bloom", "u_sway", "u_stem", "u_eye", "u_red", "u_hot", "u_alpha", "u_hi"])
        loc[n] = gl.getUniformLocation(prog, n)
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.clearColor(0, 0, 0, 0)
      return true
    }
    if (!initGL()) {
      gl = null
      ctx2d = canvas.getContext("2d")
    }
    const onLost = (e: Event) => {
      e.preventDefault()
      gl = null
    }
    const onRestored = () => {
      if (!initGL()) gl = null
    }
    canvas.addEventListener("webglcontextlost", onLost)
    markReady("stage")
    canvas.addEventListener("webglcontextrestored", onRestored)

    // ---- measuring ---------------------------------------------------------
    let W = 1
    let H = 1
    let dpr = 1
    const chars = Array.from(word.querySelectorAll<HTMLElement>("[data-ch]"))
    let nat: { x: number; y: number; w: number }[] = []
    const measure = () => {
      const sr = stage.getBoundingClientRect()
      W = Math.max(1, sr.width)
      H = Math.max(1, sr.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = Math.round(W * dpr)
      const ch = Math.round(H * dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      const saved = chars.map((c) => c.style.transform)
      chars.forEach((c) => (c.style.transform = "none"))
      nat = chars.map((c) => {
        const r = c.getBoundingClientRect()
        return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top, w: r.width }
      })
      chars.forEach((c, i) => (c.style.transform = saved[i]))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    measure()
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    const onFonts = () => measure()
    fonts?.addEventListener?.("loadingdone", onFonts)
    fonts?.ready.then(onFonts)

    // ---- frame elements -----------------------------------------------------
    const items = Array.from(stage.querySelectorAll<HTMLElement>("[data-sc]")).map((el) => ({
      el,
      scene: Number(el.dataset.sc),
      fx: el.dataset.fx as Fx,
      delay: Number(el.dataset.d) || 0,
      last: -1,
    }))

    // ---- input ----------------------------------------------------------------
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    let spin = 0
    let spinVel = 0
    let drag: { id: number; x: number } | null = null
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1
      if (drag && drag.id === e.pointerId) {
        spinVel += (e.clientX - drag.x) * 0.0022
        drag.x = e.clientX
      }
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return
      const t = e.target as HTMLElement
      if (t.closest("a,button,[contenteditable],.lys-g")) return
      drag = { id: e.pointerId, x: e.clientX }
      stage.style.cursor = "grabbing"
    }
    const onUp = () => {
      drag = null
      stage.style.cursor = ""
    }
    stage.addEventListener("pointermove", onMove)
    stage.addEventListener("pointerdown", onDown)
    window.addEventListener("pointerup", onUp)

    // ---- loop -------------------------------------------------------------------
    let raf = 0
    let running = false
    let visible = true
    let last = performance.now()
    let time = 0
    let prog01 = -1
    let shownScene = -1

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = look.current
      const moving = L.alive && !L.reduced
      if (moving) time += dt

      const r = root.getBoundingClientRect()
      const p = progressFrom(r.top, r.height, H)
      prog01 = prog01 < 0 || L.reduced ? p : prog01 + (p - prog01) * (1 - Math.exp(-dt * 9))
      const coord = sceneCoord(prog01, SCENES, HOLD)
      const scene = Math.round(coord)
      if (scene !== shownScene) {
        shownScene = scene
        setActive(scene)
      }

      // camera
      const tall = H > W * 1.05
      const k = keyAt(coord, tall)
      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 4))
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 4))
      // a drag turns the strip; it always eases back to face the camera
      // a slow turn so the cube reads as a volume; a drag spins it with inertia
      spin += spinVel + (moving ? dt * 0.12 : 0)
      spinVel *= Math.exp(-dt * 3)
      if (!moving) spinVel = 0
      const px = moving ? pointer.x : 0
      const py = moving ? pointer.y : 0
      const fov = (30 * Math.PI) / 180
      const minDim = Math.min(W, H)
      const dist = (radius * H) / (k.size * minDim * Math.tan(fov / 2))
      const el = Math.max(-88, Math.min(88, k.el + py * 9)) * (Math.PI / 180)
      const eye: V3 = [HEART[0], HEART[1] + Math.sin(el) * dist, HEART[2] + Math.cos(el) * dist]
      const proj = perspective(fov, W / H, Math.max(0.05, dist - 6), dist + 8)
      const vp = multiply(proj, lookAt(eye, HEART))
      const sway = 0
      const model = multiply(rotY(k.spin + spin + sway + px * 0.3), rotX(py * 0.06))
      const bloom = L.reduced ? 1 : L.bornAt == null ? 0 : clamp01((now - L.bornAt) / 2600)
      const gate = L.reduced ? 1 : L.bornAt == null ? 0 : clamp01((now - L.bornAt) / 1500)

      // the haze behind the cube tracks where its centre lands
      const gx = (0.5 + k.ox / 2) * W
      const gy = (0.5 - k.oy / 2) * H
      const gr = k.size * minDim * 1.25
      glow.style.transform =
        "translate(" + (gx - gr).toFixed(1) + "px," + (gy - gr).toFixed(1) + "px)"
      glow.style.width = glow.style.height = (gr * 2).toFixed(1) + "px"

      if (gl && prog) {
        const g = gl
        g.viewport(0, 0, canvas.width, canvas.height)
        g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT)
        const red = hexToLinear(L.tint)
        g.uniformMatrix4fv(loc.u_vp, false, vp)
        g.uniformMatrix4fv(loc.u_model, false, model)
        g.uniform2f(loc.u_offset, k.ox, k.oy)
        g.uniform1f(loc.u_time, time)
        g.uniform1f(loc.u_bloom, bloom)
        g.uniform1f(loc.u_sway, moving ? 1 : 0)
        g.uniform1f(loc.u_stem, k.stem)
        g.uniform3f(loc.u_eye, eye[0], eye[1], eye[2])
        g.uniform3f(loc.u_red, red[0] * 1.5, red[1] * 1.5, red[2] * 1.5)
        g.uniform3f(loc.u_hot, 0.9, 1, 1)
        g.uniform1f(loc.u_alpha, 1)
        g.uniform1f(loc.u_hi, hiRef.current)
        g.drawElements(g.TRIANGLES, mesh.index.length, g.UNSIGNED_SHORT, 0)
      } else if (ctx2d) {
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx2d.clearRect(0, 0, W, H)
      }

      // ---- the type ---------------------------------------------------------
      const still = L.reduced
      for (const it of items) {
        const v = reveal(coord, it.scene, it.delay) * (it.scene === 0 ? clamp01(gate * 1.6 - it.delay) : 1)
        const q = Math.round(v * 500) / 500
        if (q === it.last) continue
        it.last = q
        const s = it.el.style
        const dir = coord < it.scene ? 1 : -1
        s.visibility = q <= 0 ? "hidden" : ""
        if (it.fx === "draw") {
          s.setProperty("--v", String(q))
          s.opacity = String(Math.min(1, q * 3))
          continue
        }
        if (it.fx === "line") {
          s.transform = "scaleX(" + q + ")"
          s.opacity = String(Math.min(1, q * 2))
          continue
        }
        s.opacity = String(q)
        if (still || it.fx === "fade") continue
        if (it.fx === "clip") {
          const hid = ((1 - q) * 100).toFixed(1)
          s.clipPath = dir > 0 ? "inset(0 0 " + hid + "% 0)" : "inset(" + hid + "% 0 0 0)"
          s.transform = "translateY(" + ((1 - q) * 0.4 * dir).toFixed(3) + "em)"
        } else {
          s.transform = "translateY(" + ((1 - q) * 34 * dir).toFixed(1) + "px)"
          s.filter = q > 0.995 ? "" : "blur(" + ((1 - q) * 8).toFixed(1) + "px)"
        }
      }

      // The cover word morphs into the crown: its first and last letters slide
      // out to flank the flower, the rest fall into it.
      const m = easeInOut(clamp01(coord))
      const out = clamp01(coord - 1)
      const r1 = keyAt(1, tall).size * minDim * 0.5
      const cy1 = (0.5 - keyAt(1, tall).oy / 2) * H
      chars.forEach((c, i) => {
        const n0 = nat[i]
        if (!n0) return
        const flank = i === firstIdx || i === lastIdx
        if (flank && firstIdx !== lastIdx) {
          const side = i === firstIdx ? -1 : 1
          const lw = n0.w
          const tx = W / 2 + side * (r1 + lw * 0.55 + minDim * 0.02)
          const dx = (tx - n0.x) * m
          const dy = (cy1 - n0.y) * m - out * 60
          const o = coord < 1 ? 1 : 1 - smoothstep(0.1, 0.45, out)
          c.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)"
          c.style.opacity = String(o)
          c.style.filter = still || out < 0.05 ? "" : "blur(" + (out * 14).toFixed(1) + "px)"
        } else {
          const dx = (W / 2 - n0.x) * m * 0.75
          const dy = (cy1 - n0.y) * m
          const o = 1 - smoothstep(0.0, 0.4, m)
          c.style.transform = still
            ? ""
            : "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + (1 - m * 0.7).toFixed(3) + ")"
          c.style.opacity = String(o)
          c.style.filter = still || m < 0.02 ? "" : "blur(" + (m * 12).toFixed(1) + "px)"
        }
        c.style.visibility = coord > 1.6 ? "hidden" : ""
      })
    }

    const start = () => {
      if (running || !visible || document.hidden) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(root)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener("visibilitychange", onVis)
    start()

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      fonts?.removeEventListener?.("loadingdone", onFonts)
      stage.removeEventListener("pointermove", onMove)
      stage.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
      const g = gl as WebGLRenderingContext | null
      if (g) {
        g.deleteBuffer(vbo)
        g.deleteBuffer(ibo)
        g.deleteProgram(prog)
      }
    }
  }, [firstIdx, lastIdx])

  const lenis = useLenis()
  const jump = (i: number) => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    const r = root.getBoundingClientRect()
    const travel = r.height - stage.clientHeight
    const target = window.scrollY + r.top + (i / (SCENES - 1)) * travel
    if (lenis && !reduced) lenis.scrollTo(target, { duration: 1.8 })
    else window.scrollTo({ top: target })
  }

  const display: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 400 }
  const mono: React.CSSProperties = { fontFamily: MONO }
  const hidden: React.CSSProperties = { opacity: 0 }
  const left = ANALYTES.slice(0, 5)
  const right = ANALYTES.slice(5)
  return (
    <section
      ref={rootRef}
      className={"vts relative z-10 w-full " + className}
      data-play={introDone ? "" : undefined}
      style={{ height: "calc(" + height + " * " + (1 + (SCENES - 1) * sceneScroll).toFixed(3) + ")" }}
      aria-label="VITRA — urine strip colorimetry, a research prototype"
    >
      <style>{CSS}</style>
      <div
        ref={stageRef}
        className="lys-stage sticky top-0 w-full overflow-hidden select-none"
        style={{ height, color: bone, ["--lys-red" as string]: crimson } as React.CSSProperties}
        onPointerOver={(e) => {
          const g = (e.target as HTMLElement).closest<HTMLElement>("[data-g]")?.dataset.g
          if (g) setInspect(ANALYTES.find((a) => a.key === g) ?? null)
        }}
        onPointerLeave={() => setInspect(null)}
      >
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 rounded-full"
          style={{ background: "radial-gradient(closest-side, " + tint + "26, " + tint + "0d 45%, transparent 100%)", willChange: "transform" }}
        />
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block" style={{ width: "100%", height: "100%", maxWidth: "none" }} />

        {/* ================================ 0 · cover ================================ */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute flex items-start justify-between gap-8" style={{ left: "4.5cqw", right: "4.5cqw", top: "5cqh" }}>
            <div {...sc(0, "clip", 0)} style={{ ...display, ...hidden, fontSize: "clamp(22px, 3.1cqw, 48px)", lineHeight: 0.86, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Vitra
              <br />
              Instrument
            </div>
            <p {...sc(0, "rise", 0.15)} style={{ ...display, ...hidden, maxWidth: "26cqw", fontSize: "clamp(13px, 1.12cqw, 17px)", lineHeight: 1.32, margin: 0, opacity: 0.85 }}>
              An experimental computer-vision platform for controlled urine-strip analysis, calibration and clinical review. A sealed, LED-lit
              enclosure photographs a ten-pad reagent strip after a timed reaction — and the colours become numbers a clinician can review.
            </p>
            <ul {...sc(0, "rise", 0.3)} style={{ ...mono, ...hidden, listStyle: "none", margin: 0, padding: 0, fontSize: "clamp(10px, 0.78cqw, 12px)", lineHeight: 1.75, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.75 }}>
              {SPECS.map((s, i) => (
                <li key={s}>
                  <span style={{ color: crimson }}>{String(i + 1).padStart(2, "0")}</span>&nbsp;&nbsp;{s}
                </li>
              ))}
            </ul>
            <div {...sc(0, "clip", 0.45)} style={{ ...display, ...hidden, fontSize: "clamp(20px, 2.5cqw, 40px)", lineHeight: 0.88, textAlign: "right", textTransform: "uppercase" }}>
              Urine
              <br />
              Strip
              <br />
              <i style={{ textTransform: "none" }}>colorimetry</i>
            </div>
          </div>

          <div ref={wordRef} className="absolute whitespace-nowrap" style={{ ...display, left: "50%", top: "56%", transform: "translate(-50%, -50%)", fontSize: "min(27cqw, 44cqh)", lineHeight: 1, letterSpacing: "0.02em" }}>
            <span {...sc(0, "rise", 0.55)} style={{ ...hidden, ...mono, position: "absolute", right: "0.04em", bottom: "100%", fontSize: "0.03em", letterSpacing: "0.34em", color: crimson, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              KJS-HC-03 · Point of care
            </span>
            <h2 style={{ margin: 0, font: "inherit" }} aria-label={name}>
              {letters.map((c, i) => (
                <span key={i} data-ch className="inline-block" style={{ willChange: "transform" }} aria-hidden>
                  <span className="lys-char" style={{ animationDelay: 0.1 + i * 0.09 + "s", textShadow: "0 0 60px rgba(127,220,234,0.12)" }}>
                    {c}
                  </span>
                </span>
              ))}
            </h2>
          </div>

          <div className="absolute flex items-end justify-between gap-8" style={{ left: "4.5cqw", right: "4.5cqw", bottom: "6.5cqh" }}>
            <div {...sc(0, "rise", 0.35)} style={hidden}>
              <h1 style={{ ...display, margin: 0, fontSize: "clamp(26px, 2.9cqw, 46px)", lineHeight: 1.0, letterSpacing: "-0.01em", maxWidth: "15em" }}>
                Turn reagent colours into <i style={{ color: crimson }}>measurable</i> data.
              </h1>
              <div style={{ ...mono, marginTop: 14, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.55 }}>
                K J Somaiya School of Engineering · Research prototype · Not a medical device
              </div>
            </div>
            <div {...sc(0, "rise", 0.5)} className="pointer-events-auto flex items-center gap-3" style={hidden}>
              <Link href="/methodology" className="glass glass-pill px-6 py-3.5 text-[14px] text-[#f2ebdd]/90 transition-colors hover:text-[#f2ebdd]" style={{ borderRadius: 999 }}>
                Explore the Methodology
              </Link>
              <Link href="/console" className="glass-cta">
                Open Analysis Console
                <span className="glass-cta-dot">
                  <Arrow />
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* ================================ 1 · reaction ================================ */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute flex justify-center" style={{ left: 0, right: 0, top: "12.5cqh" }}>
            <div {...sc(1, "rise", 0.3)} style={hidden}>
              <ReagentStripGlass develop={active >= 1} />
            </div>
          </div>
          <div {...sc(1, "fade", 0.5)} className="absolute" style={{ ...mono, ...hidden, left: 0, right: 0, top: "79cqh", textAlign: "center", fontSize: 10, letterSpacing: "0.3em", color: crimson }}>
            T + 120 S · CAPTURE
          </div>
          <div {...sc(1, "rise", 0.6)} className="absolute" style={{ ...mono, ...hidden, left: "4.5cqw", bottom: "5.5cqh", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <span style={{ color: crimson }}>02</span> — The reaction · 120 s
          </div>
          <p {...sc(1, "rise", 0.7)} className="absolute" style={{ ...display, ...hidden, right: "4.5cqw", bottom: "5.5cqh", margin: 0, maxWidth: "24em", textAlign: "right", fontSize: "clamp(15px, 1.35cqw, 21px)", lineHeight: 1.3, opacity: 0.85 }}>
            Each pad keeps developing after it is wetted — above, every pad is a point in RGB space, travelling as its colour changes. The device waits a fixed <i>120 seconds</i>, then captures the same moment, every strip.
          </p>
        </div>

        {/* ============================== 2 · analytes ============================== */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div className="pointer-events-auto absolute grid items-center" style={{ left: "7cqw", right: "7cqw", top: "11cqh", bottom: "22cqh", gridTemplateColumns: "1fr min(32cqw, 40cqh) 1fr", columnGap: "2cqw" }}>
            <Pads list={left} side="l" from={1} />
            <div className="relative h-full text-center">
              <div {...sc(2, "rise", 0.35)} className="absolute w-full" style={{ ...hidden, top: "6%", fontSize: "min(2.4cqw, 3.4cqh)", lineHeight: 1 }}>
                Ten pads
                <div style={{ ...mono, fontSize: 9, letterSpacing: "0.3em", opacity: 0.55, marginTop: 8 }}>ONE STRIP · ONE CAPTURE</div>
              </div>
              <div {...sc(2, "rise", 0.45)} className="absolute w-full" style={{ ...hidden, top: "58%", lineHeight: 1.05 }}>
                <div style={{ fontSize: inspect ? "min(7cqw, 10cqh)" : "min(2.6cqw, 3.6cqh)", color: inspect ? crimson : undefined, transition: "font-size .45s cubic-bezier(.2,.8,.2,1)" }}>
                  {inspect ? inspect.label : <i>hover a pad</i>}
                </div>
                {inspect ? (
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 12 }}>
                    <div style={{ height: 10, borderRadius: 2, margin: "0 auto 10px", width: "70%", background: "linear-gradient(90deg," + inspect.demoRamp.join(",") + ")", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.35)" }} />
                    <div style={{ opacity: 0.75 }}>
                      {inspect.short} · {inspect.unit} · {inspect.kind}
                    </div>
                    <div style={{ opacity: 0.5, marginTop: 6 }}>Synthetic demo ramp · illustrative</div>
                    {inspect.critical && <div style={{ color: crimson, marginTop: 6 }}>False negatives critical · KJS-HC-03</div>}
                  </div>
                ) : (
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "0.25em", opacity: 0.5, marginTop: 10 }}>EACH ONE A COLOUR · EACH COLOUR THREE NUMBERS</div>
                )}
              </div>
            </div>
            <Pads list={right} side="r" from={6} />
          </div>
          <div {...sc(2, "line", 0.5)} className="absolute" style={{ ...hidden, left: "7cqw", right: "7cqw", bottom: "15cqh", height: 1, background: bone + "40", transformOrigin: "left" }} />
          <div {...sc(2, "rise", 0.6)} className="absolute text-center" style={{ ...hidden, left: "5cqw", right: "5cqw", bottom: "7.5cqh", fontSize: "min(1.9cqw, 2.8cqh)", whiteSpace: "nowrap" }}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} style={{ marginRight: "0.55em" }}>
                <span>R{subscript(i + 1)}</span> <span>G{subscript(i + 1)}</span> <span>B{subscript(i + 1)}</span>
                {i < 9 && <span style={{ color: crimson, marginLeft: "0.35em" }}>·</span>}
              </span>
            ))}
            <div style={{ ...mono, fontSize: 9, letterSpacing: "0.3em", opacity: 0.5, marginTop: 10 }}>THE 30-DIMENSIONAL VECTOR THE REGRESSION SEES</div>
          </div>
        </div>

        {/* ================================ 3 · instrument =============================== */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div className="absolute text-center" style={{ left: "50%", top: "10cqh", transform: "translateX(-50%)", fontSize: "min(15cqw, 12.5cqh)", lineHeight: 0.88, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            <span {...sc(3, "fade", 0.3)} style={{ ...hidden, ...mono, position: "absolute", right: "100%", top: "0.4em", fontSize: "0.07em", letterSpacing: "0.3em", marginRight: "1.6em" }}>
              VITRA
            </span>
            <span {...sc(3, "fade", 0.4)} style={{ ...hidden, ...mono, position: "absolute", left: "100%", top: "0.4em", fontSize: "0.07em", letterSpacing: "0.3em", marginLeft: "1.6em" }}>
              INSTRUMENT
            </span>
            <div {...sc(3, "clip", 0)} style={hidden}>Sealed</div>
            <div {...sc(3, "clip", 0.15)} style={hidden}>
              <i style={{ textTransform: "none" }}>timed</i>
            </div>
            <div {...sc(3, "clip", 0.3)} style={hidden}>Measured</div>
          </div>
          <div className="absolute flex justify-center" style={{ left: 0, right: 0, bottom: "5cqh" }}>
            <div {...sc(3, "rise", 0.6)} style={{ ...mono, ...hidden, fontSize: 9, letterSpacing: "0.8em", textTransform: "uppercase", whiteSpace: "nowrap", paddingLeft: "0.8em" }}>
              K J Somaiya School of Engineering
            </div>
          </div>
        </div>

        {/* ================================ 4 · signal =============================== */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div className="absolute" style={{ left: "9cqw", top: "30cqh", fontSize: "min(10.5cqw, 14cqh)", lineHeight: 0.82 }}>
            {TAGLINE.map((t, i) => (
              <div
                key={i}
                {...sc(4, "clip", i * 0.14)}
                style={{
                  ...hidden,
                  fontSize: t.small ? "0.36em" : undefined,
                  fontStyle: t.small ? "italic" : undefined,
                  lineHeight: t.small ? 1.1 : undefined,
                  marginLeft: t.small ? (i < 2 ? "4.6em" : "3.6em") : i > 1 ? "0.45em" : 0,
                  marginTop: t.small ? "-0.1em" : 0,
                  marginBottom: t.small ? "0.25em" : 0,
                  color: t.small ? crimson : undefined,
                }}
              >
                {t.text}
              </div>
            ))}
            <div {...sc(4, "rise", 0.7)} style={{ ...mono, ...hidden, fontSize: 9, letterSpacing: "0.25em", marginTop: "3.5cqh", opacity: 0.7, textTransform: "uppercase", lineHeight: 2 }}>
              Capture · isolate · extract · calibrate · review
              <br />
              <span style={{ opacity: 0.7 }}>Numbers only where a compatible calibration exists</span>
            </div>
          </div>
        </div>

        {/* ============================== 5 · console ============================== */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div className="absolute flex items-center justify-around" style={{ left: "4cqw", right: "4cqw", top: "50cqh" }}>
            <div className="pointer-events-auto relative text-center">
              <div {...sc(5, "fade", 0.1)} style={{ ...mono, ...hidden, fontSize: 10, letterSpacing: "0.3em", marginBottom: "1.6cqh", opacity: 0.7 }}>
                OPEN THE
              </div>
              <Link {...sc(5, "clip", 0)} href="/console" className="lys-link relative block" style={{ ...hidden, fontSize: "min(10cqw, 14cqh)", lineHeight: 1 }}>
                Console
                <svg
                  {...sc(5, "draw", 0.2)}
                  aria-hidden
                  viewBox="0 0 100 100"
                  style={{ ...hidden, position: "absolute", left: "50%", top: "50%", width: "1.5em", height: "1.5em", transform: "translate(-50%,-46%)", overflow: "visible", pointerEvents: "none" }}
                >
                  <circle cx="50" cy="50" r="48" fill="none" stroke={crimson} strokeWidth="0.8" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: "calc(1 - var(--v, 0))" } as React.CSSProperties} />
                  <path d="M2 50H98M50 2V98" fill="none" stroke={crimson} strokeWidth="0.6" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: "calc(1 - var(--v, 0))", opacity: 0.6 } as React.CSSProperties} />
                </svg>
              </Link>
              <div {...sc(5, "rise", 0.4)} className="flex justify-center gap-[3.5cqw]" style={{ ...hidden, marginTop: "3cqh" }}>
                {[
                  ["10", "pads"],
                  ["30", "features"],
                  ["120", "seconds"],
                ].map(([n, l]) => (
                  <div key={l} className="text-center">
                    <div style={{ fontSize: "min(3cqw, 4.2cqh)", lineHeight: 1 }}>{n}</div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "0.25em", opacity: 0.6, textTransform: "uppercase" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pointer-events-auto relative">
              <div {...sc(5, "fade", 0.3)} style={{ ...mono, ...hidden, fontSize: 10, letterSpacing: "0.3em", opacity: 0.7 }}>
                FROM
              </div>
              <div {...sc(5, "clip", 0.35)} style={{ ...hidden, fontSize: "min(6.6cqw, 9.5cqh)", lineHeight: 1, whiteSpace: "nowrap" }}>
                Light<span style={{ color: crimson }}>·</span>Colour<span style={{ color: crimson }}>·</span>
                <i>Data</i>
              </div>
              <div {...sc(5, "fade", 0.5)} style={{ ...mono, ...hidden, fontSize: 10, letterSpacing: "0.3em", textAlign: "right", opacity: 0.7 }}>
                FOR CLINICAL REVIEW
              </div>
            </div>
          </div>

          <div {...sc(5, "rise", 0.75)} className="pointer-events-auto absolute flex items-center justify-between gap-4" style={{ ...mono, ...hidden, left: "4.5cqw", right: "4.5cqw", bottom: "4.5cqh", fontSize: "clamp(10px, 1cqw, 13px)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            <Link href="/console" className="lys-link">
              Open Analysis Console →
            </Link>
            <span className="flex items-center gap-3" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.25em" }}>
              <Mark color={tint} accent={crimson} />
              Research prototype · not clinically validated
            </span>
            <Link href="/methodology" className="lys-link">
              Explore the Methodology →
            </Link>
          </div>
        </div>

        {/* ================================== nav ================================== */}
        <nav aria-label="Homescreen frames" className="lys-nav absolute flex flex-col items-end" style={{ ...mono, right: "1.6cqw", top: "50%", transform: "translateY(-50%)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {NAV.map((n, i) => (
            <button key={n} type="button" onClick={() => jump(i)} aria-current={active === i ? "step" : undefined}>
              <span className="lys-lab">
                {String(i + 1).padStart(2, "0")} {n}
              </span>
              <span className="lys-tick" />
            </button>
          ))}
        </nav>

        {/* scroll cue, cover only */}
        <div {...sc(0, "fade", 0.8)} className="pointer-events-none absolute bottom-[1.6cqh] left-1/2 -translate-x-1/2" style={{ ...mono, ...hidden, fontSize: 9, letterSpacing: "0.4em", opacity: 0.5 }}>
          SCROLL
        </div>
      </div>
    </section>
  )
}

/**
 * The ten-pad strip as a pane of glass. Pads start at the low end of their
 * synthetic demo ramp and develop towards the middle when the reaction frame
 * arrives — a picture of the 120 s window, not a measurement.
 */
function ReagentStripGlass({ develop }: { develop: boolean }) {
  return (
    <div className="glass flex items-center gap-[0.55cqw] px-[1.1cqw] py-[0.9cqh]" style={{ borderRadius: 10 }}>
      <div style={{ width: "7cqw", height: "3.4cqh", borderRadius: 4, background: "linear-gradient(90deg, rgba(242,235,221,.22), rgba(242,235,221,.08))", fontFamily: MONO, fontSize: 8, letterSpacing: "0.2em", display: "grid", placeItems: "center", color: "rgba(242,235,221,.6)" }}>
        SYN-10P
      </div>
      {ANALYTES.map((a, i) => (
        <div key={a.key} className="flex flex-col items-center gap-1">
          <span
            style={{
              display: "block", width: "2.1cqw", height: "3.4cqh", borderRadius: 3,
              backgroundColor: develop ? jewel(a) : "#2a2722",
              boxShadow: "inset 0 0 0 1px rgba(201,169,110,.45), inset 0 1px 0 rgba(255,255,255,.25), 0 0 18px " + (develop ? jewel(a) + "55" : "transparent"),
              transition: "background-color 2.4s cubic-bezier(.4,0,.2,1) " + i * 0.12 + "s, box-shadow 2.4s " + i * 0.12 + "s",
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.12em", opacity: 0.6 }}>{a.short}</span>
        </div>
      ))}
      <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", opacity: 0.55, marginLeft: "0.6cqw", lineHeight: 1.6 }}>
        SYNTHETIC
        <br />
        ILLUSTRATIVE
      </div>
    </div>
  )
}

/** One column of five pads. Top-level so React keeps its DOM across renders (the scroll loop holds these nodes). */
function Pads({ list, side, from }: { list: readonly AnalyteDef[]; side: "l" | "r"; from: number }) {
  const hidden: React.CSSProperties = { opacity: 0 }
  const mono: React.CSSProperties = { fontFamily: MONO }
  return (
    <div className={"relative flex flex-col gap-[1.2cqh] " + (side === "r" ? "items-end text-right" : "")}>
      <div {...sc(2, "fade", 0.3)} style={hidden}>
        <Side label={side === "l" ? "PADS 01–05" : "PADS 06–10"} side={side} />
      </div>
      {list.map((a, i) => (
        <div key={a.key} {...sc(2, "clip", (side === "l" ? 0 : 0.1) + i * 0.06)} style={hidden}>
          <span className="lys-g" data-g={a.key} style={{ fontSize: "min(6.4cqw, 7.4cqh)", lineHeight: 1 }}>
            {side === "r" && <PadDot a={a} />}
            {a.short}
            {side === "l" && <PadDot a={a} />}
          </span>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.22em", opacity: 0.5, textTransform: "uppercase", marginTop: 2 }}>
            {String(from + i).padStart(2, "0")} · {a.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function Side({ label, side }: { label: string; side: "l" | "r" }) {
  return (
    <span
      style={{
        fontFamily: MONO, position: "absolute", top: "50%", [side === "l" ? "right" : "left"]: "calc(100% + 18px)",
        fontSize: 8, letterSpacing: "0.25em", opacity: 0.5, lineHeight: 1,
        transform: "translate(" + (side === "l" ? "50%" : "-50%") + ",-50%) rotate(" + (side === "l" ? -90 : 90) + "deg)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  )
}

/** The pad's synthetic mid-ramp colour, as a small swatch beside its code. */
function PadDot({ a }: { a: AnalyteDef }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block", width: "0.32em", height: "0.32em", borderRadius: "0.06em", margin: "0 0.22em",
        verticalAlign: "0.18em", background: jewel(a), boxShadow: "0 0 18px " + jewel(a) + "66, inset 0 0 0 1px rgba(201,169,110,.5)",
      }}
    />
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

/** A six-strap lily, drawn as the mark. */
function Mark({ color, accent }: { color: string; accent: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden style={{ flex: "none" }}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M20 20 C 22 12, 30 8, 33 12 C 35 15, 31 17, 29 14" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" transform={"rotate(" + a + " 20 20)"} />
      ))}
      <circle cx="20" cy="20" r="2.6" fill={accent} />
    </svg>
  )
}
