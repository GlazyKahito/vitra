/* Offline ambient stub for "react" — loose on purpose. */
declare module "react" {
  export type Key = string | number | bigint;
  export type ReactNode = any;
  export type ReactElement<P = any, T = any> = { type: T; props: P; key: Key | null };
  export type JSXElementConstructor<P> = (props: P) => any;
  export type ElementType<P = any> = string | JSXElementConstructor<P>;
  export type FC<P = {}> = (props: P) => ReactNode;
  export type FunctionComponent<P = {}> = FC<P>;
  export type ComponentType<P = {}> = FC<P> | (new (props: P) => any);
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  export type ComponentProps<T> = T extends (props: infer P) => any ? P : T extends keyof JSX.IntrinsicElements ? JSX.IntrinsicElements[T] : any;
  export type ComponentPropsWithoutRef<T> = Omit<ComponentProps<T>, "ref">;
  export type ComponentPropsWithRef<T> = ComponentProps<T>;
  export type CSSProperties = { [prop: string]: string | number | undefined };
  export type Ref<T> = ((instance: T | null) => void) | RefObject<T | null> | null;
  export type RefCallback<T> = (instance: T | null) => void;
  export type ForwardedRef<T> = Ref<T>;
  export interface RefObject<T> { current: T }
  export interface MutableRefObject<T> { current: T }
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Reducer<S, A> = (prev: S, action: A) => S;
  export type EffectCallback = () => void | (() => void);
  export type DependencyList = ReadonlyArray<unknown>;
  export type Context<T> = { Provider: (props: { value: T; children?: ReactNode }) => any; Consumer: any; displayName?: string };
  export type Provider<T> = Context<T>["Provider"];

  export interface SyntheticEvent<T = Element, E = Event> {
    nativeEvent: E; currentTarget: T; target: EventTarget & T; bubbles: boolean; cancelable: boolean;
    defaultPrevented: boolean; eventPhase: number; isTrusted: boolean; preventDefault(): void;
    isDefaultPrevented(): boolean; stopPropagation(): void; isPropagationStopped(): boolean; persist(): void; timeStamp: number; type: string;
  }
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> { target: EventTarget & T }
  export interface MouseEvent<T = Element, E = globalThis.MouseEvent> extends SyntheticEvent<T, E> {
    altKey: boolean; button: number; buttons: number; clientX: number; clientY: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; pageX: number; pageY: number; screenX: number; screenY: number; relatedTarget: EventTarget | null; movementX: number; movementY: number;
  }
  export interface PointerEvent<T = Element> extends MouseEvent<T, globalThis.PointerEvent> { pointerId: number; pointerType: string }
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T, globalThis.KeyboardEvent> {
    key: string; code: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; repeat: boolean; keyCode: number;
  }
  export interface FocusEvent<T = Element> extends SyntheticEvent<T, globalThis.FocusEvent> { relatedTarget: EventTarget | null }
  export interface DragEvent<T = Element> extends MouseEvent<T, globalThis.DragEvent> { dataTransfer: DataTransfer }
  export interface TouchEvent<T = Element> extends SyntheticEvent<T, globalThis.TouchEvent> { touches: TouchList }
  export interface WheelEvent<T = Element> extends MouseEvent<T, globalThis.WheelEvent> { deltaX: number; deltaY: number }
  export interface UIEvent<T = Element> extends SyntheticEvent<T, globalThis.UIEvent> {}
  export interface AnimationEvent<T = Element> extends SyntheticEvent<T> {}
  export interface TransitionEvent<T = Element> extends SyntheticEvent<T> {}
  export type EventHandler<E> = (event: E) => void;
  export type MouseEventHandler<T = Element> = EventHandler<MouseEvent<T>>;
  export type ChangeEventHandler<T = Element> = EventHandler<ChangeEvent<T>>;
  export type FormEventHandler<T = Element> = EventHandler<FormEvent<T>>;
  export type KeyboardEventHandler<T = Element> = EventHandler<KeyboardEvent<T>>;

  /** Loose DOM attribute bag; specific event handlers are typed, everything else is allowed. */
  export interface DOMAttributes<T> {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    onClick?: MouseEventHandler<T>; onDoubleClick?: MouseEventHandler<T>; onMouseDown?: MouseEventHandler<T>; onMouseUp?: MouseEventHandler<T>;
    onMouseEnter?: MouseEventHandler<T>; onMouseLeave?: MouseEventHandler<T>; onMouseMove?: MouseEventHandler<T>; onMouseOver?: MouseEventHandler<T>; onMouseOut?: MouseEventHandler<T>;
    onContextMenu?: MouseEventHandler<T>;
    onPointerDown?: EventHandler<PointerEvent<T>>; onPointerUp?: EventHandler<PointerEvent<T>>; onPointerMove?: EventHandler<PointerEvent<T>>; onPointerEnter?: EventHandler<PointerEvent<T>>; onPointerLeave?: EventHandler<PointerEvent<T>>;
    onChange?: ChangeEventHandler<T>; onInput?: FormEventHandler<T>; onSubmit?: FormEventHandler<T>; onReset?: FormEventHandler<T>; onInvalid?: FormEventHandler<T>;
    onKeyDown?: KeyboardEventHandler<T>; onKeyUp?: KeyboardEventHandler<T>; onKeyPress?: KeyboardEventHandler<T>;
    onFocus?: EventHandler<FocusEvent<T>>; onBlur?: EventHandler<FocusEvent<T>>;
    onDragOver?: EventHandler<DragEvent<T>>; onDragEnter?: EventHandler<DragEvent<T>>; onDragLeave?: EventHandler<DragEvent<T>>; onDrop?: EventHandler<DragEvent<T>>; onDragStart?: EventHandler<DragEvent<T>>; onDragEnd?: EventHandler<DragEvent<T>>; onDrag?: EventHandler<DragEvent<T>>;
    onScroll?: EventHandler<UIEvent<T>>; onWheel?: EventHandler<WheelEvent<T>>;
    onTouchStart?: EventHandler<TouchEvent<T>>; onTouchEnd?: EventHandler<TouchEvent<T>>; onTouchMove?: EventHandler<TouchEvent<T>>;
    onLoad?: EventHandler<SyntheticEvent<T>>; onError?: EventHandler<SyntheticEvent<T>>; onLoadedMetadata?: EventHandler<SyntheticEvent<T>>; onCanPlay?: EventHandler<SyntheticEvent<T>>;
    onAnimationEnd?: EventHandler<AnimationEvent<T>>; onTransitionEnd?: EventHandler<TransitionEvent<T>>;
    onToggle?: EventHandler<SyntheticEvent<T>>; onClose?: EventHandler<SyntheticEvent<T>>; onCancel?: EventHandler<SyntheticEvent<T>>;
  }
  export interface AriaAttributes { [aria: `aria-${string}`]: any }
  export interface HTMLAttributes<T = HTMLElement> extends DOMAttributes<T>, AriaAttributes {
    className?: string; id?: string; style?: CSSProperties; title?: string; role?: string; tabIndex?: number; hidden?: boolean;
    lang?: string; dir?: string; draggable?: boolean; contentEditable?: boolean | "true" | "false" | "inherit" | "plaintext-only";
    suppressHydrationWarning?: boolean; key?: Key; ref?: Ref<T>;
    [data: `data-${string}`]: any;
  }
  export interface ButtonHTMLAttributes<T = HTMLButtonElement> extends HTMLAttributes<T> {
    type?: "button" | "submit" | "reset"; disabled?: boolean; form?: string; formAction?: string | ((formData: FormData) => void | Promise<void>); name?: string; value?: string | number | readonly string[]; autoFocus?: boolean;
  }
  export interface InputHTMLAttributes<T = HTMLInputElement> extends HTMLAttributes<T> {
    type?: string; name?: string; value?: string | number | readonly string[]; defaultValue?: string | number | readonly string[]; placeholder?: string; disabled?: boolean; readOnly?: boolean; required?: boolean;
    checked?: boolean; defaultChecked?: boolean; min?: number | string; max?: number | string; step?: number | string; accept?: string; multiple?: boolean; autoComplete?: string; autoFocus?: boolean;
    pattern?: string; maxLength?: number; minLength?: number; list?: string; form?: string; inputMode?: string; size?: number; capture?: boolean | string;
  }
  export interface SelectHTMLAttributes<T = HTMLSelectElement> extends HTMLAttributes<T> {
    name?: string; value?: string | number | readonly string[]; defaultValue?: string | number | readonly string[]; disabled?: boolean; required?: boolean; multiple?: boolean; autoFocus?: boolean; form?: string; size?: number; autoComplete?: string;
  }
  export interface OptionHTMLAttributes<T = HTMLOptionElement> extends HTMLAttributes<T> { value?: string | number | readonly string[]; disabled?: boolean; selected?: boolean; label?: string }
  export interface TextareaHTMLAttributes<T = HTMLTextAreaElement> extends HTMLAttributes<T> {
    name?: string; value?: string | number | readonly string[]; defaultValue?: string | number | readonly string[]; placeholder?: string; disabled?: boolean; readOnly?: boolean; required?: boolean; rows?: number; cols?: number; maxLength?: number; minLength?: number; autoFocus?: boolean; form?: string; wrap?: string; autoComplete?: string;
  }
  export interface LabelHTMLAttributes<T = HTMLLabelElement> extends HTMLAttributes<T> { htmlFor?: string; form?: string }
  export interface FormHTMLAttributes<T = HTMLFormElement> extends HTMLAttributes<T> { action?: string | ((formData: FormData) => void | Promise<void>); method?: string; encType?: string; noValidate?: boolean; autoComplete?: string; target?: string }
  export interface AnchorHTMLAttributes<T = HTMLAnchorElement> extends HTMLAttributes<T> { href?: string; target?: string; rel?: string; download?: any; hrefLang?: string; type?: string; referrerPolicy?: string }
  export interface ImgHTMLAttributes<T = HTMLImageElement> extends HTMLAttributes<T> { src?: string; alt?: string; width?: number | string; height?: number | string; loading?: "eager" | "lazy"; decoding?: string; sizes?: string; srcSet?: string; crossOrigin?: string; referrerPolicy?: string; fetchPriority?: string }
  export interface TableHTMLAttributes<T = HTMLTableElement> extends HTMLAttributes<T> { cellPadding?: number | string; cellSpacing?: number | string; summary?: string; width?: number | string }
  export interface TdHTMLAttributes<T = HTMLTableCellElement> extends HTMLAttributes<T> { colSpan?: number; rowSpan?: number; headers?: string; scope?: string; align?: string; valign?: string; width?: number | string; height?: number | string; abbr?: string }
  export interface ThHTMLAttributes<T = HTMLTableCellElement> extends HTMLAttributes<T> { colSpan?: number; rowSpan?: number; headers?: string; scope?: string; align?: string; abbr?: string }
  export interface SVGAttributes<T> extends DOMAttributes<T>, AriaAttributes { [attr: string]: any }
  export interface SVGProps<T> extends SVGAttributes<T> { ref?: Ref<T> }
  export type DetailedHTMLProps<E, T> = E & { ref?: Ref<T> };

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useRef<T>(initial: T): MutableRefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useId(): string;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps: DependencyList): T;
  export function useReducer<S, A>(reducer: Reducer<S, A>, initial: S, init?: (arg: S) => S): [S, Dispatch<A>];
  export function useTransition(): [boolean, (cb: () => void | Promise<void>) => void];
  export function useDeferredValue<T>(value: T): T;
  export function useOptimistic<S, A = S>(state: S, update?: (state: S, action: A) => S): [S, (action: A) => void];
  export function useActionState<S, P = FormData>(action: (state: Awaited<S>, payload: P) => S | Promise<S>, initial: Awaited<S>, permalink?: string): [state: Awaited<S>, dispatch: (payload: P) => void, isPending: boolean];
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T): T;
  export function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: DependencyList): void;
  export function useDebugValue<T>(value: T, format?: (v: T) => any): void;
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;
  export function use<T>(usable: Promise<T> | Context<T>): T;
  export function forwardRef<T, P = {}>(render: (props: P, ref: ForwardedRef<T>) => ReactNode): (props: P & { ref?: Ref<T> }) => ReactNode;
  export function memo<P>(component: (props: P) => ReactNode, propsAreEqual?: (a: P, b: P) => boolean): (props: P) => ReactNode;
  export function lazy<T extends ComponentType<any>>(load: () => Promise<{ default: T }>): T;
  export function cache<F extends (...args: any[]) => any>(fn: F): F;
  export function startTransition(cb: () => void): void;
  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;
  export function cloneElement(element: ReactElement, props?: any, ...children: any[]): ReactElement;
  export function isValidElement(obj: any): obj is ReactElement;
  export function createRef<T>(): RefObject<T | null>;
  export const Fragment: (props: { children?: ReactNode; key?: Key }) => ReactNode;
  export const StrictMode: (props: { children?: ReactNode }) => ReactNode;
  export const Suspense: (props: { children?: ReactNode; fallback?: ReactNode; name?: string }) => ReactNode;
  export const Profiler: any;
  export const Children: { map<T, R>(children: T, fn: (child: T, i: number) => R): R[]; forEach(children: any, fn: (child: any, i: number) => void): void; count(children: any): number; only(children: any): any; toArray(children: any): any[] };
  export const version: string;

  export namespace JSX {
    type Element = any;
    interface ElementClass { render(): any }
    interface ElementAttributesProperty { props: {} }
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: Key }
    interface IntrinsicClassAttributes<T> { ref?: Ref<T> }
    interface IntrinsicElements { [el: string]: any }
  }
  const React: any;
  export default React;
}
declare module "react-dom" {
  export function createPortal(children: any, container: Element | DocumentFragment, key?: string | null): any;
  export function flushSync(fn: () => void): void;
  export function useFormStatus(): { pending: boolean; data: FormData | null; method: string | null; action: any };
  export function preload(href: string, opts?: any): void;
  const ReactDOM: any;
  export default ReactDOM;
}
declare module "react-dom/client" { export function createRoot(el: Element): { render(node: any): void; unmount(): void }; export function hydrateRoot(el: Element, node: any): any; }
declare module "react/jsx-runtime" {
  export const jsx: any; export const jsxs: any; export const Fragment: any;
  export namespace JSX {
    type Element = any;
    interface ElementClass { render(): any }
    interface ElementAttributesProperty { props: {} }
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: string | number | bigint }
    interface IntrinsicClassAttributes<T> { ref?: any }
    interface IntrinsicElements { [el: string]: any }
  }
}
declare module "react/jsx-dev-runtime" { export const jsxDEV: any; export const Fragment: any; }
