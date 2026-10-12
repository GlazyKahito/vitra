/* Offline ambient stubs for three / r3f / drei — loose on purpose. */
declare module "three" {
  export class Vector3 { constructor(x?: number, y?: number, z?: number); x: number; y: number; z: number; set(x: number, y: number, z: number): this; copy(v: Vector3): this; clone(): Vector3; lerp(v: Vector3, a: number): this; length(): number; normalize(): this; multiplyScalar(s: number): this; add(v: Vector3): this; sub(v: Vector3): this }
  export class Vector2 { constructor(x?: number, y?: number); x: number; y: number; set(x: number, y: number): this }
  export class Euler { constructor(x?: number, y?: number, z?: number, order?: string); x: number; y: number; z: number; set(x: number, y: number, z: number): this }
  export class Quaternion { x: number; y: number; z: number; w: number; setFromEuler(e: Euler): this; slerp(q: Quaternion, t: number): this }
  export class Color { constructor(c?: string | number); r: number; g: number; b: number; set(c: string | number): this; lerp(c: Color, a: number): this }
  export class Object3D { position: Vector3; rotation: Euler; scale: Vector3; quaternion: Quaternion; visible: boolean; name: string; children: Object3D[]; parent: Object3D | null; add(...o: Object3D[]): this; remove(...o: Object3D[]): this; lookAt(v: Vector3 | number, y?: number, z?: number): void; traverse(cb: (o: Object3D) => void): void; updateMatrixWorld(force?: boolean): void; userData: Record<string, any>; castShadow: boolean; receiveShadow: boolean }
  export class Group extends Object3D {}
  export class Scene extends Object3D { background: any }
  export class Mesh<G = any, M = any> extends Object3D { geometry: G; material: M }
  export class Camera extends Object3D {}
  export class PerspectiveCamera extends Camera { constructor(fov?: number, aspect?: number, near?: number, far?: number); fov: number; aspect: number; near: number; far: number; updateProjectionMatrix(): void }
  export class OrthographicCamera extends Camera { zoom: number; updateProjectionMatrix(): void }
  export class Material { transparent: boolean; opacity: number; needsUpdate: boolean; side: number; dispose(): void }
  export class MeshStandardMaterial extends Material { constructor(p?: any); color: Color; roughness: number; metalness: number; emissive: Color; emissiveIntensity: number }
  export class MeshPhysicalMaterial extends MeshStandardMaterial { clearcoat: number; clearcoatRoughness: number; transmission: number }
  export class MeshBasicMaterial extends Material { constructor(p?: any); color: Color }
  export class BufferGeometry { dispose(): void; attributes: Record<string, any>; setAttribute(name: string, attr: any): this; computeVertexNormals(): void }
  export class BoxGeometry extends BufferGeometry { constructor(w?: number, h?: number, d?: number) }
  export class PlaneGeometry extends BufferGeometry { constructor(w?: number, h?: number) }
  export class CylinderGeometry extends BufferGeometry { constructor(...a: number[]) }
  export class SphereGeometry extends BufferGeometry { constructor(...a: number[]) }
  export class BufferAttribute { constructor(arr: ArrayLike<number>, size: number) }
  export class Float32BufferAttribute extends BufferAttribute {}
  export class Light extends Object3D { intensity: number; color: Color }
  export class DirectionalLight extends Light { target: Object3D; shadow: any }
  export class PointLight extends Light {}
  export class SpotLight extends Light {}
  export class AmbientLight extends Light {}
  export class Texture { needsUpdate: boolean; dispose(): void; colorSpace: string; wrapS: number; wrapT: number; repeat: Vector2 }
  export class CanvasTexture extends Texture { constructor(canvas: HTMLCanvasElement) }
  export class Clock { getElapsedTime(): number; getDelta(): number }
  export class MathUtils { static lerp(a: number, b: number, t: number): number; static clamp(v: number, a: number, b: number): number; static degToRad(d: number): number; static radToDeg(r: number): number; static damp(a: number, b: number, l: number, dt: number): number; static smoothstep(x: number, a: number, b: number): number; static randFloat(a: number, b: number): number }
  export const MathUtils: typeof MathUtils;
  export const DoubleSide: number; export const FrontSide: number; export const BackSide: number; export const SRGBColorSpace: string; export const ACESFilmicToneMapping: number; export const RepeatWrapping: number;
  export class WebGLRenderer { domElement: HTMLCanvasElement; setSize(w: number, h: number): void; render(s: Scene, c: Camera): void; dispose(): void; toneMapping: number; shadowMap: any }
}
declare module "@react-three/fiber" {
  import type { ReactNode, Ref, CSSProperties } from "react";
  import type { Scene, Camera, WebGLRenderer, Clock, Vector2 } from "three";
  export interface RootState { gl: WebGLRenderer; scene: Scene; camera: Camera & { [k: string]: any }; clock: Clock; pointer: Vector2; mouse: Vector2; size: { width: number; height: number; top: number; left: number }; viewport: { width: number; height: number; factor: number; distance: number; aspect: number }; invalidate(): void; get(): RootState; set(s: Partial<RootState>): void; raycaster: any; frameloop: string }
  export interface CanvasProps { children?: ReactNode; className?: string; style?: CSSProperties; camera?: Record<string, any>; dpr?: number | [number, number]; shadows?: boolean | string | Record<string, any>; gl?: Record<string, any>; frameloop?: "always" | "demand" | "never"; flat?: boolean; linear?: boolean; orthographic?: boolean; resize?: any; onCreated?: (state: RootState) => void; onPointerMissed?: (e: any) => void; eventSource?: any; eventPrefix?: string; fallback?: ReactNode; ref?: Ref<HTMLCanvasElement>; [k: string]: any }
  export function Canvas(props: CanvasProps): any;
  export function useFrame(cb: (state: RootState, delta: number, frame?: any) => void, renderPriority?: number): void;
  export function useThree<T = RootState>(selector?: (s: RootState) => T): T;
  export function useLoader(loader: any, url: string | string[], ext?: any): any;
  export function extend(objects: Record<string, any>): void;
  export function invalidate(): void;
  export type ThreeElements = { [el: string]: any };
  export type ThreeEvent<E> = E & { object: any; point: any; distance: number; stopPropagation(): void; eventObject: any };
}
declare module "@react-three/drei" {
  import type { ReactNode } from "react";
  type AnyProps = { children?: ReactNode; [k: string]: any };
  export function RoundedBox(props: AnyProps & { args?: [number?, number?, number?]; radius?: number; smoothness?: number; bevelSegments?: number; creaseAngle?: number; steps?: number }): any;
  export function OrbitControls(props: AnyProps): any; export function Environment(props: AnyProps): any; export function ContactShadows(props: AnyProps): any;
  export function Float(props: AnyProps): any; export function Html(props: AnyProps): any; export function Text(props: AnyProps): any; export function Center(props: AnyProps): any;
  export function PerspectiveCamera(props: AnyProps): any; export function Stage(props: AnyProps): any; export function PresentationControls(props: AnyProps): any;
  export function Edges(props: AnyProps): any; export function Line(props: AnyProps): any; export function Grid(props: AnyProps): any; export function Sparkles(props: AnyProps): any;
  export function MeshTransmissionMaterial(props: AnyProps): any; export function Lightformer(props: AnyProps): any; export function Bounds(props: AnyProps): any; export function AdaptiveDpr(props: AnyProps): any; export function Preload(props: AnyProps): any;
  export function useGLTF(url: string): any; export function useTexture(url: string | string[]): any; export function useCursor(hovered: boolean): void;
}
