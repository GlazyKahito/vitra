/* Offline ambient stubs for next/* — loose on purpose. */
declare module "next" {
  export interface Metadata { title?: string | { default?: string; template?: string; absolute?: string }; description?: string; keywords?: string | string[]; robots?: any; icons?: any; openGraph?: any; twitter?: any; metadataBase?: URL | null; applicationName?: string; authors?: any; creator?: string; themeColor?: any; viewport?: any; other?: Record<string, any>; [k: string]: any }
  export interface Viewport { themeColor?: string | { media: string; color: string }[]; width?: string | number; initialScale?: number; maximumScale?: number; userScalable?: boolean; colorScheme?: string; viewportFit?: string }
  export interface NextConfig { [key: string]: any }
  export type NextPage<P = {}> = (props: P) => any;
}
declare module "next/link" {
  import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
  export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
    href: string | { pathname?: string; query?: Record<string, string | number | undefined> | string; hash?: string };
    replace?: boolean; scroll?: boolean; prefetch?: boolean | null; shallow?: boolean; locale?: string | false; legacyBehavior?: boolean; passHref?: boolean;
    children?: ReactNode; ref?: Ref<HTMLAnchorElement>;
  }
  export default function Link(props: LinkProps): any;
}
declare module "next/image" {
  import type { ImgHTMLAttributes } from "react";
  export interface StaticImageData { src: string; height: number; width: number; blurDataURL?: string }
  export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "alt"> {
    src: string | StaticImageData; alt: string; width?: number | `${number}`; height?: number | `${number}`; fill?: boolean; priority?: boolean; quality?: number | `${number}`;
    placeholder?: "blur" | "empty" | `data:image/${string}`; blurDataURL?: string; unoptimized?: boolean; sizes?: string; loader?: any; onLoadingComplete?: any;
  }
  export default function Image(props: ImageProps): any;
}
declare module "next/navigation" {
  export function redirect(url: string, type?: "replace" | "push"): never;
  export function permanentRedirect(url: string, type?: "replace" | "push"): never;
  export function notFound(): never;
  export function forbidden(): never;
  export function unauthorized(): never;
  export interface AppRouterInstance { push(href: string, opts?: { scroll?: boolean }): void; replace(href: string, opts?: { scroll?: boolean }): void; refresh(): void; back(): void; forward(): void; prefetch(href: string): void }
  export function useRouter(): AppRouterInstance;
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useParams<T extends Record<string, string | string[]> = Record<string, string | string[]>>(): T;
  export function useSelectedLayoutSegment(parallelRouteKey?: string): string | null;
  export function useSelectedLayoutSegments(parallelRouteKey?: string): string[];
  export class ReadonlyURLSearchParams extends URLSearchParams {}
}
declare module "next/headers" {
  export interface RequestCookie { name: string; value: string }
  export interface ResponseCookie extends RequestCookie { httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" | boolean; path?: string; maxAge?: number; expires?: Date | number; domain?: string; priority?: "low" | "medium" | "high" }
  export interface ReadonlyRequestCookies {
    get(name: string): RequestCookie | undefined; getAll(): RequestCookie[]; has(name: string): boolean;
    set(name: string, value: string, options?: Partial<ResponseCookie>): ReadonlyRequestCookies; set(cookie: ResponseCookie): ReadonlyRequestCookies;
    delete(name: string): ReadonlyRequestCookies; delete(opts: { name: string; path?: string; domain?: string }): ReadonlyRequestCookies;
  }
  export function cookies(): Promise<ReadonlyRequestCookies>;
  export function headers(): Promise<Headers>;
  export function draftMode(): Promise<{ isEnabled: boolean; enable(): void; disable(): void }>;
}
declare module "next/cache" {
  export function revalidatePath(path: string, type?: "page" | "layout"): void;
  export function revalidateTag(tag: string): void;
  export function unstable_cache<T extends (...args: any[]) => Promise<any>>(fn: T, keys?: string[], opts?: { revalidate?: number | false; tags?: string[] }): T;
  export function unstable_noStore(): void;
}
declare module "next/server" {
  export class NextRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit);
    readonly nextUrl: URL & { searchParams: URLSearchParams; pathname: string; basePath: string; origin: string };
    readonly cookies: { get(name: string): { name: string; value: string } | undefined; getAll(): { name: string; value: string }[]; has(name: string): boolean; set(name: string, value: string): any; delete(name: string): any };
    readonly ip?: string;
    readonly geo?: Record<string, string | undefined>;
  }
  export class NextResponse<Body = unknown> extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly cookies: { get(name: string): { name: string; value: string } | undefined; getAll(): { name: string; value: string }[]; set(name: string, value: string, options?: Record<string, unknown>): any; set(cookie: Record<string, unknown>): any; delete(name: string): any };
    static json<T>(body: T, init?: ResponseInit): NextResponse<T>;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    static rewrite(url: string | URL, init?: ResponseInit): NextResponse;
    static next(init?: ResponseInit & { request?: { headers?: Headers } }): NextResponse;
  }
  export type NextMiddleware = (req: NextRequest) => NextResponse | Response | void | Promise<NextResponse | Response | void>;
  export function after(cb: () => void | Promise<void>): void;
}
declare module "next/dynamic" {
  import type { ComponentType, ReactNode } from "react";
  export interface DynamicOptions<P> { loading?: (props: { error?: Error | null; isLoading?: boolean; pastDelay?: boolean }) => ReactNode; ssr?: boolean; suspense?: boolean }
  export default function dynamic<P = {}>(loader: () => Promise<ComponentType<P> | { default: ComponentType<P> }>, options?: DynamicOptions<P>): ComponentType<P>;
}
declare module "next/font/google" {
  export interface NextFont { className: string; style: { fontFamily: string; fontWeight?: number; fontStyle?: string }; variable: string }
  export interface FontOptions { weight?: string | string[]; style?: string | string[]; subsets?: string[]; display?: "auto" | "block" | "swap" | "fallback" | "optional"; variable?: `--${string}`; preload?: boolean; fallback?: string[]; adjustFontFallback?: boolean; axes?: string[] }
  export function Inter(opts?: FontOptions): NextFont;
  export function Inter_Tight(opts?: FontOptions): NextFont;
  export function JetBrains_Mono(opts?: FontOptions): NextFont;
  export function Geist(opts?: FontOptions): NextFont;
  export function Geist_Mono(opts?: FontOptions): NextFont;
  export function IBM_Plex_Mono(opts?: FontOptions): NextFont;
}
declare module "next/font/local" { export default function localFont(opts: any): { className: string; style: any; variable: string } }
declare module "next/script" { export default function Script(props: any): any }
declare module "next/og" { export class ImageResponse extends Response { constructor(el: any, opts?: any) } }
declare module "server-only" {}
declare module "client-only" {}
