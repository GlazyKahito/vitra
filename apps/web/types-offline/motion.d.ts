/* Offline ambient stub for motion (framer-motion successor) — loose on purpose. */
declare module "motion/react" {
  import type { ReactNode, RefObject, Ref } from "react";
  export type Variant = Record<string, any>;
  export type Variants = Record<string, Variant | ((custom: any) => Variant)>;
  export type Transition = Record<string, any>;
  export interface MotionProps {
    initial?: any; animate?: any; exit?: any; whileHover?: any; whileTap?: any; whileFocus?: any; whileInView?: any; whileDrag?: any;
    variants?: Variants; transition?: Transition; layout?: boolean | "position" | "size" | "preserve-aspect"; layoutId?: string; custom?: any;
    viewport?: { once?: boolean; amount?: number | "some" | "all"; margin?: string; root?: RefObject<Element | null> };
    style?: Record<string, any>; drag?: boolean | "x" | "y"; dragConstraints?: any; onAnimationComplete?: (def: any) => void; onAnimationStart?: (def: any) => void;
    onViewportEnter?: (entry: IntersectionObserverEntry | null) => void; onViewportLeave?: (entry: IntersectionObserverEntry | null) => void;
    onUpdate?: (latest: any) => void; transformTemplate?: any; inherit?: boolean;
  }
  export type MotionComponent<T = any> = (props: MotionProps & { ref?: Ref<any>; children?: ReactNode; key?: any; [prop: string]: any }) => any;
  export const motion: { [el: string]: MotionComponent } & { create<P>(component: (props: P) => any, opts?: any): (props: P & MotionProps & { [k: string]: any }) => any };
  export const m: typeof motion;
  export function useReducedMotion(): boolean | null;
  export interface MotionValue<T = any> { get(): T; set(v: T): void; on(event: string, cb: (v: T) => void): () => void; onChange(cb: (v: T) => void): () => void; getVelocity(): number; destroy(): void }
  export function useMotionValue<T>(initial: T): MotionValue<T>;
  export function useTransform<I, O>(value: MotionValue<I>, input: I[] | ((v: I) => O), output?: O[], opts?: any): MotionValue<O>;
  export function useTransform<O>(fn: () => O): MotionValue<O>;
  export function useSpring(value: MotionValue<number> | number, config?: { stiffness?: number; damping?: number; mass?: number; restDelta?: number; restSpeed?: number; bounce?: number; duration?: number }): MotionValue<number>;
  export function useScroll(opts?: { container?: RefObject<any>; target?: RefObject<any>; offset?: any[]; axis?: "x" | "y"; layoutEffect?: boolean }): { scrollX: MotionValue<number>; scrollY: MotionValue<number>; scrollXProgress: MotionValue<number>; scrollYProgress: MotionValue<number> };
  export function useInView(ref: RefObject<Element | null>, opts?: { once?: boolean; amount?: number | "some" | "all"; margin?: string; root?: RefObject<Element | null>; initial?: boolean }): boolean;
  export function useMotionValueEvent<T>(value: MotionValue<T>, event: string, cb: (v: T) => void): void;
  export function useAnimate(): [RefObject<any>, (...args: any[]) => any];
  export function useAnimation(): any;
  export function useAnimationFrame(cb: (time: number, delta: number) => void): void;
  export function useTime(): MotionValue<number>;
  export function useVelocity(v: MotionValue<number>): MotionValue<number>;
  export function useMotionTemplate(strings: TemplateStringsArray, ...values: MotionValue[]): MotionValue<string>;
  export function animate(...args: any[]): any;
  export function stagger(duration?: number, opts?: any): any;
  export function AnimatePresence(props: { children?: ReactNode; mode?: "sync" | "wait" | "popLayout"; initial?: boolean; onExitComplete?: () => void; custom?: any; propagate?: boolean }): any;
  export function MotionConfig(props: { children?: ReactNode; transition?: Transition; reducedMotion?: "user" | "always" | "never"; nonce?: string }): any;
  export function LazyMotion(props: { children?: ReactNode; features: any; strict?: boolean }): any;
  export const domAnimation: any; export const domMax: any;
  export function LayoutGroup(props: { children?: ReactNode; id?: string }): any;
  export const Reorder: any;
}
declare module "motion" { export * from "motion/react"; }
declare module "gsap" {
  export interface TweenVars { [key: string]: any }
  export interface Tween { kill(): void; pause(): Tween; play(): Tween; progress(v?: number): any; reverse(): Tween; restart(): Tween; then(cb?: any): Promise<any>; scrollTrigger?: any; revert(): void }
  export interface Timeline extends Tween { to(target: any, vars: TweenVars, position?: any): Timeline; from(target: any, vars: TweenVars, position?: any): Timeline; fromTo(target: any, from: TweenVars, to: TweenVars, position?: any): Timeline; set(target: any, vars: TweenVars, position?: any): Timeline; add(child: any, position?: any): Timeline; addLabel(label: string, position?: any): Timeline; call(cb: () => void, params?: any[], position?: any): Timeline; clear(): Timeline; seek(position: any): Timeline; time(v?: number): any; duration(v?: number): any; totalProgress(v?: number): any }
  export interface Context { add(fn: () => void): void; revert(): void; kill(): void }
  export interface MatchMedia { add(query: string | Record<string, string>, fn: (ctx: any) => void | (() => void), scope?: any): MatchMedia; revert(): void; kill(): void }
  export interface GSAP {
    to(target: any, vars: TweenVars): Tween; from(target: any, vars: TweenVars): Tween; fromTo(target: any, from: TweenVars, to: TweenVars): Tween; set(target: any, vars: TweenVars): Tween;
    timeline(vars?: TweenVars): Timeline; registerPlugin(...plugins: any[]): void; context(fn?: (self: Context) => void, scope?: any): Context; matchMedia(scope?: any): MatchMedia;
    quickTo(target: any, prop: string, vars?: TweenVars): (value: number) => Tween; quickSetter(target: any, prop: string, unit?: string): (value: any) => void;
    utils: { toArray<T = Element>(sel: any, scope?: any): T[]; clamp(min: number, max: number, v?: number): any; mapRange(a: number, b: number, c: number, d: number, v?: number): any; interpolate(a: any, b: any, v?: number): any; random(min: number, max: number, snap?: number): number; snap(v: any, target?: any): any; wrap(a: any, b?: any, v?: any): any; pipe(...fns: any[]): any; selector(scope: any): any; normalize(a: number, b: number, v?: number): any; getUnit(v: string): string; splitColor(v: string): number[] };
    ticker: { add(cb: (time: number, deltaTime: number, frame: number) => void): void; remove(cb: any): void; lagSmoothing(a?: number, b?: number): void; fps(v?: number): void };
    getProperty(target: any, prop: string, unit?: string): any; killTweensOf(target: any): void; defaults(vars: TweenVars): void; config(vars: any): void; delayedCall(delay: number, cb: () => void, params?: any[]): Tween; globalTimeline: Timeline; version: string;
  }
  export const gsap: GSAP;
  export default gsap;
}
declare module "gsap/ScrollTrigger" {
  export interface ScrollTriggerInstance { kill(revert?: boolean): void; refresh(): void; progress: number; direction: number; isActive: boolean; start: number; end: number; scroll(v?: number): any; enable(): void; disable(): void; getVelocity(): number; trigger: Element | null }
  export interface ScrollTriggerStatic {
    create(vars: Record<string, any>): ScrollTriggerInstance; refresh(safe?: boolean): void; update(): void; getAll(): ScrollTriggerInstance[]; killAll(): void; getById(id: string): ScrollTriggerInstance | undefined;
    batch(targets: any, vars: Record<string, any>): ScrollTriggerInstance[]; config(vars: Record<string, any>): void; defaults(vars: Record<string, any>): void; normalizeScroll(v?: any): any;
    matchMedia(vars: Record<string, () => void>): void; addEventListener(type: string, cb: (...a: any[]) => void): void; removeEventListener(type: string, cb: (...a: any[]) => void): void; maxScroll(el: any): number; isInViewport(el: any, ratio?: number): boolean; sort(): void; clearMatchMedia(): void;
  }
  export const ScrollTrigger: ScrollTriggerStatic;
  export default ScrollTrigger;
}
declare module "gsap/all" { export * from "gsap"; export { ScrollTrigger } from "gsap/ScrollTrigger"; }
