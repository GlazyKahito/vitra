"use client";

import { useEffect, useRef } from "react";
import { markReady } from "./film-intro";

/**
 * The live background, fixed behind the whole landing. One full-screen pass
 * that layers two 21st.dev backgrounds:
 *  - the colour field is Componentry's "Animated Gradient" (MIT,
 *    github.com/harshjdhv/componentry): value noise, domain distortion and an
 *    iterated swirl, blended through three stops — ported to WebGL1 and tuned
 *    to the emerald-onyx palette;
 *  - over it runs the folded "Silk" wave sheen (the style of the 21st.dev
 *    "Waves background"), as soft light catching cloth.
 * Scroll drifts both so the page reads as moving across the fabric; the
 * pointer presses a soft dent into it. Rendered at reduced resolution (it is
 * soft anyway) and paused when the tab is hidden.
 */

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform float u_scroll;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
const float E = 2.71828182845904523536;
const float PI = 3.14159265358979;
const float TWO_PI = 6.28318530718;

float grain(vec2 p) {
  vec2 r = E * sin(E * p);
  return fract(r.x * r.y * (1.0 + p.x));
}
vec2 rot(vec2 uv, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * uv;
}
float hash(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}
float vnoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float pull = exp(-dot(p - m, p - m) * 3.5);

  // Componentry field: distortion + iterated swirl, three-stop blend
  float t = 0.5 * (u_time * 0.22 + u_scroll * 0.6);
  vec2 uv = (v_uv - 0.5) * vec2(aspect, 1.0) * 2.4;
  uv = rot(uv, -0.25 * PI) + 0.5;
  uv += pull * 0.18;
  float n1 = vnoise(uv + t);
  float n2 = vnoise(uv * 2.0 - t);
  float ang = n1 * TWO_PI;
  uv += 0.28 * n2 * vec2(cos(ang), sin(ang));
  for (float i = 1.0; i <= 8.0; i++) {
    uv.x += 0.55 / i * cos(t + i * 1.5 * uv.y);
    uv.y += 0.55 / i * cos(t + i * 1.0 * uv.x);
  }
  float mixer = 0.5 + 0.5 * sin(uv.x * 1.6) * cos(uv.y * 1.6);
  float r1 = smoothstep(0.0, 0.7, mixer);
  float r2 = smoothstep(0.35, 1.05, mixer);
  vec3 field = mix(mix(u_c0, u_c1, r1), u_c2, r2 * 0.85);

  // Silk sheen
  vec2 tex = rot(p * 1.35, -0.42) + vec2(0.0, u_scroll * 0.35) + pull * 0.06;
  float ts = u_time * 0.32;
  tex.y += 0.03 * sin(8.0 * tex.x - ts);
  float silk = 0.6 + 0.4 * sin(5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * ts) + sin(20.0 * (tex.x + tex.y - 0.1 * ts)));
  float sheen = pow(silk, 6.0);
  vec3 col = field + u_c3 * sheen * (0.10 + 0.22 * r2) + u_c2 * pull * 0.08;

  // keep the edges in the dark so the type always reads
  vec2 q = v_uv - 0.5;
  col *= 1.0 - dot(q, q) * 1.4;
  col -= grain(gl_FragCoord.xy) / 40.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

/** onyx, deep emerald, emerald, champagne sheen */
const PALETTE = ["#040706", "#081d17", "#0f4536", "#ebdab0"] as const;

const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function SilkWaves({ scale = 0.42 }: { scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) {
      markReady("bg");
      return;
    }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      markReady("bg");
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = u("u_time");
    const uScroll = u("u_scroll");
    const uRes = u("u_res");
    const uMouse = u("u_mouse");
    PALETTE.forEach((c, i) => gl.uniform3fv(u(`u_c${i}`), toRgb(c)));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const w = Math.max(1, Math.round(window.innerWidth * scale));
      const h = Math.max(1, Math.round(window.innerHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let readied = false;
    let scroll = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const target = window.scrollY / Math.max(1, window.innerHeight);
      scroll += (target - scroll) * 0.08;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform1f(uTime, reduce ? 4 : (now - start) / 1000);
      gl.uniform1f(uScroll, scroll);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!readied) {
        readied = true;
        markReady("bg");
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(draw);
    // under reduced motion, still follow the scroll with a static frame
    const onScroll = () => reduce && requestAnimationFrame(draw);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [scale]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-ink-0">
      <canvas ref={ref} className="h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_35%,rgba(4,6,8,0.5)_100%)]" />
    </div>
  );
}
