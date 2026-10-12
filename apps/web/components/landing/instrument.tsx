"use client";

import Image from "next/image";
import { useRef } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { cn } from "@/lib/utils";
import { Chapter } from "./chapter";
import { EnclosureDiagram } from "./fx/enclosure-diagram";
import { SplitWords } from "./fx/split";
import { gsap, useScrollScene } from "./fx/use-scroll-scene";

const FRAMES = [
  { src: "/media/prototype-1.jpg", title: "Opaque enclosure", body: "A sealed, matte-black housing. Ambient light never reaches the strip; every photon on the pad comes from the device." },
  { src: "/media/prototype-2.jpg", title: "Touchscreen on the upper face", body: "A Raspberry Pi 5 drives a front-mounted display for the operator: insert, wait, review." },
  { src: "/media/prototype-3.jpg", title: "Strip slot at the base", body: "The strip slides in handle-first along a fixed track so the ten pads land at a known position relative to the camera." },
  { src: "/media/prototype-4.jpg", title: "Timed, lit, captured", body: "Brightness-regulated LED strips and a Pi camera; the capture fires after a 120 s timed reaction." },
] as const;

const CAPTION = "Prototype enclosure — KJS-HC-03 use-case document, Fig. 1";
/** Which diagram callouts (fx/enclosure-diagram CALLOUTS index) draw on with each frame. */
const CALLS_BY_FRAME: readonly (readonly number[])[] = [[0], [1], [2], [3, 4, 5]];

/** Timeline units: iris 0→3, panel 2.8→3.6, then one 1.9-unit window per frame. */
const IRIS = 3;
const FRAME_START = 3.5;
const FRAME_LEN = 1.9;
const pad2 = (n: number) => String(n).padStart(2, "0");
const DRAWN = "[data-body] > *, [data-lid] [stroke-dasharray]";

/**
 * Chapter 03 — the instrument. A title card hangs over the live background;
 * when the section pins, an iris opens on an exploded line drawing of the
 * enclosure, which then tells its story frame by frame (lid lifts, strip
 * slides in, LEDs and camera come on) while the matching prototype photo sits
 * beside it as a small graded specimen plate at its native size.
 */
export function Instrument() {
  const pinRef = useRef<HTMLDivElement>(null);

  const reduced = useScrollScene(pinRef, (pin) => {
    const wrap = pin.querySelector<HTMLElement>("[data-iris-wrap]")!;
    const stage = pin.querySelector<HTMLElement>("[data-stage]")!;
    const ring = pin.querySelector<HTMLElement>("[data-ring]")!;
    const lid = pin.querySelector("[data-lid]");
    const strip = pin.querySelector("[data-strip]");
    const plates = gsap.utils.toArray<HTMLElement>("[data-plate]", pin);
    const items = gsap.utils.toArray<HTMLElement>("[data-item]", pin);
    const caps = gsap.utils.toArray<HTMLElement>("[data-cap]", pin);
    const segs = gsap.utils.toArray<HTMLElement>("[data-seg]", pin);
    const calls = gsap.utils.toArray<SVGGElement>("[data-call]", pin);

    // Iris radius in px, so the gold ring rides the exact same edge.
    const maxR = () => Math.hypot(wrap.clientWidth, wrap.clientHeight) / 2 + 4;
    const iris = { r: 0 };
    const paintIris = () => {
      const R = maxR();
      stage.style.clipPath = `circle(${(iris.r * R).toFixed(1)}px at 50% 50%)`;
      ring.style.width = ring.style.height = `${(R * 2).toFixed(0)}px`;
      ring.style.transform = `translate(-50%,-50%) scale(${iris.r.toFixed(4)})`;
    };
    paintIris();

    gsap.set(plates.slice(1), { opacity: 0 });
    gsap.set([...items, ...caps], { opacity: 0, y: 14 });
    gsap.set(segs, { scaleX: 0 });
    gsap.set(pin.querySelectorAll(`[data-leader], [data-dial-arc], ${DRAWN}`), { strokeDashoffset: 1 });
    gsap.set(pin.querySelectorAll("[data-label]"), { opacity: 0 });
    gsap.set(lid, { y: 92 });
    gsap.set(pin.querySelector("[data-guide]"), { opacity: 0 });
    gsap.set(strip, { x: 230, opacity: 0 });
    gsap.set(pin.querySelector("[data-led]"), { opacity: 0.12 });
    gsap.set(pin.querySelector("[data-cone]"), { opacity: 0 });

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 5.2)}`,
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });

    // iris onto the drawing; the outlines draw as it opens
    tl.to(iris, { r: 1, duration: IRIS, ease: "power2.inOut", onUpdate: paintIris }, 0);
    tl.to(ring, { opacity: 0, duration: 0.5 }, IRIS - 0.4);
    tl.to(pin.querySelectorAll(DRAWN), { strokeDashoffset: 0, duration: 1.4, stagger: 0.1, ease: "power1.inOut" }, 0.4);
    tl.to("[data-title]", { opacity: 0, scale: 1.06, y: -30, duration: 0.9, ease: "power1.in" }, IRIS - 0.9);
    tl.fromTo("[data-panel]", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "power2.out" }, IRIS - 0.2);
    tl.fromTo("[data-plates]", { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "power2.out" }, IRIS - 0.1);
    tl.fromTo("[data-hud]", { opacity: 0 }, { opacity: 1, duration: 0.6 }, IRIS);

    // perforations advance through the gutters the whole way
    const total = FRAME_START + FRAMES.length * FRAME_LEN + 0.4;
    tl.fromTo("[data-perf]", { y: 0 }, { y: -28 * 64, duration: total }, 0);

    FRAMES.forEach((_, i) => {
      const at = FRAME_START + i * FRAME_LEN;
      // plate swap: crossfade + settle
      tl.fromTo(plates[i]!, { scale: 1.06 }, { scale: 1, duration: FRAME_LEN * 0.8, ease: "power2.out" }, at - 0.5);
      if (i > 0) tl.to(plates[i]!, { opacity: 1, duration: 0.5, ease: "power1.inOut" }, at - 0.5);
      tl.to([items[i]!, caps[i]!], { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, at - (i === 0 ? 0.1 : 0.3));
      if (i < FRAMES.length - 1) tl.to([items[i]!, caps[i]!], { opacity: 0, y: -12, duration: 0.35, ease: "power2.in" }, at + FRAME_LEN - 0.65);
      tl.to(segs[i]!, { scaleX: 1, duration: FRAME_LEN }, at);
      tl.to("[data-odo]", { yPercent: -25 * i, duration: 0.35, ease: "power3.inOut" }, at - 0.4);
      tl.to("[data-sheet-mark]", { x: i * 68, duration: 0.4, ease: "power3.inOut" }, at - 0.4);

      // the drawing tells the same frame
      if (i === 1) {
        tl.to(lid, { y: 0, duration: 0.9, ease: "power2.inOut" }, at - 0.1);
        tl.to(pin.querySelector("[data-guide]"), { opacity: 1, duration: 0.5 }, at + 0.3);
      }
      if (i === 2) tl.to(strip, { x: 0, opacity: 1, duration: 0.9, ease: "power2.out" }, at - 0.1);
      if (i === 3) {
        tl.to(pin.querySelector("[data-led]"), { opacity: 1, duration: 0.4 }, at);
        tl.to(pin.querySelector("[data-cone]"), { opacity: 1, duration: 0.6 }, at + 0.25);
        tl.to(pin.querySelector("[data-dial-arc]"), { strokeDashoffset: 0, duration: 1.1 }, at + 0.4);
      }
      (CALLS_BY_FRAME[i] ?? []).forEach((c, k) => {
        const g = calls[c];
        if (!g) return;
        const t = at + 0.35 + k * 0.22;
        tl.to(g.querySelector("[data-leader]"), { strokeDashoffset: 0, duration: 0.5, ease: "power1.inOut" }, t);
        tl.to(g.querySelector("[data-label]"), { opacity: 1, duration: 0.3 }, t + 0.35);
      });
    });
    tl.to({}, { duration: 0.4 });

    // the title card's words rise as the section arrives, before the pin
    gsap.fromTo(
      pin.querySelectorAll("[data-title] [data-w]"),
      { yPercent: 115, opacity: 0 },
      { yPercent: 0, opacity: 1, stagger: 0.15, ease: "power3.out", scrollTrigger: { trigger: pin, start: "top 85%", end: "top 15%", scrub: 0.8 } },
    );
  });

  if (reduced) {
    return (
      <Chapter index="04" label="The instrument" id="instrument">
        <div className="grid grid-cols-[420px_1fr] items-start gap-12 py-16">
          <GlassTilt className="p-9">
            <h2 className="t-serif text-[72px]">
              Light, <em>controlled.</em>
            </h2>
            <p className="t-serif mt-3 text-[26px] italic text-[var(--film-cream-dim)]">A box that removes the room.</p>
            <ul className="mt-8 flex flex-col gap-5">
              {FRAMES.map((f, i) => (
                <li key={f.src}>
                  <div className="t-eyebrow">Plate {pad2(i + 1)}</div>
                  <div className="mt-1 text-[17px] text-fg">{f.title}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-fg-2">{f.body}</p>
                </li>
              ))}
            </ul>
          </GlassTilt>
          <div>
            <EnclosureDiagram className="mx-auto h-auto w-full max-w-[600px]" />
            <div className="mt-10 grid grid-cols-4 gap-4">
              {FRAMES.map((f) => (
                <div key={f.src} className="lc-plate aspect-square">
                  <Image src={f.src} alt={f.title} width={480} height={480} sizes="240px" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">{CAPTION}</div>
          </div>
        </div>
      </Chapter>
    );
  }

  return (
    <Chapter index="04" label="The instrument" id="instrument" bleed>
      <div ref={pinRef} className="relative h-screen w-full overflow-hidden">
        {/* gutters: perforations advance while the section is pinned */}
        {(["left", "right"] as const).map((side) => (
          <div
            key={side}
            className={cn("absolute inset-y-0 z-20 w-12 overflow-hidden border-[rgb(var(--lc-ivory-rgb)/0.08)]", side === "left" ? "left-0 border-r" : "right-0 border-l")}
            aria-hidden
          >
            <div data-perf className="lc-perf-y absolute inset-x-0 top-0 h-[calc(100%+1800px)] will-change-transform" />
          </div>
        ))}

        <div className="absolute inset-y-0 left-24 right-24 grid grid-cols-[360px_1fr_256px] items-center gap-6">
          {/* copy on glass */}
          <div data-panel>
            <GlassTilt className="p-8" max={4}>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--lc-gold)]">Scene 04 · The instrument</div>
              <h3 className="t-serif mt-4 text-[54px]">
                Light, <em>controlled.</em>
              </h3>
              <p className="t-serif mt-2 text-[22px] italic text-[var(--film-cream-dim)]">A box that removes the room.</p>
              <div className="lc-hair my-6" />
              <div className="relative h-[124px]">
                {FRAMES.map((f) => (
                  <div key={f.src} data-item className="absolute inset-0">
                    <h4 className="text-[19px] font-medium tracking-[-0.02em] text-fg">{f.title}</h4>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{f.body}</p>
                  </div>
                ))}
              </div>
            </GlassTilt>
          </div>

          {/* the drawing, opened by the iris */}
          <div className="grid min-w-0 place-items-center">
            <div data-iris-wrap className="relative aspect-square h-[min(560px,70vh)] max-w-full">
              <div data-stage className="absolute inset-0" style={{ clipPath: "circle(0px at 50% 50%)" }}>
                <EnclosureDiagram className="h-full w-full" />
              </div>
              <div data-ring className="lc-iris-ring pointer-events-none absolute left-1/2 top-1/2 rounded-full" style={{ transform: "translate(-50%,-50%) scale(0)" }} aria-hidden />
            </div>
          </div>

          {/* specimen plates */}
          <div data-plates>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--lux-platinum,#bfc1c2)]">Plate</span>
              <span className="flex items-baseline">
                <span className="t-serif text-[56px] leading-none">0</span>
                <span className="t-serif relative inline-block h-[56px] overflow-hidden text-[56px] leading-none">
                  <span data-odo className="flex flex-col">
                    {FRAMES.map((_, i) => (
                      <span key={i} className="block h-[56px]">
                        {i + 1}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="ml-2 font-mono text-[12px] text-[var(--film-cream-dim)]">/ {pad2(FRAMES.length)}</span>
              </span>
            </div>
            <div className="lc-plate relative mt-4 aspect-square w-full">
              {FRAMES.map((f, i) => (
                <div key={f.src} data-plate className="absolute inset-0 will-change-transform">
                  <Image src={f.src} alt={f.title} width={480} height={480} sizes="256px" loading={i === 0 ? undefined : "eager"} priority={i === 0} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <div className="relative mt-3 h-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--lux-platinum,#bfc1c2)]">
              {FRAMES.map((f, i) => (
                <span key={f.src} data-cap className="absolute inset-0 truncate">
                  Fig. 1.{i + 1} · {f.title}
                </span>
              ))}
            </div>
            {/* contact sheet */}
            <div className="relative mt-5 flex gap-2">
              {FRAMES.map((f) => (
                <div key={f.src} className="lc-plate size-[60px] shrink-0 !rounded-[9px]">
                  <Image src={f.src} alt="" width={120} height={120} sizes="60px" loading="eager" className="h-full w-full object-cover" />
                </div>
              ))}
              <span data-sheet-mark className="pointer-events-none absolute left-0 top-0 size-[60px] rounded-[9px] shadow-[0_0_0_1.5px_var(--lc-gold)]" aria-hidden />
            </div>
          </div>
        </div>

        {/* title card, before the iris opens */}
        <div data-title className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-center">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--lc-gold)]">Fig. 1 · The instrument</div>
            <h2 className="t-serif mt-6 text-[clamp(110px,11.5vw,168px)] leading-[0.9]">
              <SplitWords text="Light, *controlled.*" />
            </h2>
            <p className="t-serif mt-6 text-[34px] italic text-[var(--film-cream-dim)]">A box that removes the room.</p>
          </div>
        </div>

        {/* HUD: caption + progress */}
        <div data-hud className="pointer-events-none absolute inset-x-24 bottom-8 z-20 flex items-end justify-between opacity-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">{CAPTION} · schematic, not to scale</div>
          <div className="flex items-center gap-2">
            {FRAMES.map((f) => (
              <span key={f.src} className="relative h-[2px] w-12 overflow-hidden rounded-full bg-[rgb(var(--lc-ivory-rgb)/0.18)]">
                <span data-seg className="absolute inset-0 origin-left bg-[var(--lc-gold)]" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </Chapter>
  );
}
