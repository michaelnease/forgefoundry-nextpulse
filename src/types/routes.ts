/**
 * Route type definitions for NextPulse route inspector
 */

export type RouterKind = "app" | "pages";

export type RouteKind =
  | "page"
  | "layout"
  | "loading"
  | "error"
  | "routeHandler"
  | "apiRoute"
  | "other";

export type SegmentType =
  | "static"
  | "dynamic"
  | "catchAll"
  | "optionalCatchAll"
  | "routeGroup"
  | "parallelRoute";

export interface RouteInfo {
  router: RouterKind;
  path: string; // e.g. "/", "/blog/[slug]", "/api/posts"
  file: string; // relative to project root, e.g. "app/page.tsx"
  kind: RouteKind;
  segmentType: SegmentType;
  hasLayout?: boolean; // optional hints for App Router
}

export interface AppRouteTreeNode {
  segment: string; // "", "blog", "[slug]", "(marketing)", "@modal"
  path: string; // "/blog", "/blog/[slug]"
  children: AppRouteTreeNode[];
  hasPage: boolean;
  hasLayout: boolean;
  hasLoading: boolean;
  hasError: boolean;
  hasRouteHandler: boolean;
  parallelRoutes?: string[]; // like ["@modal", "@feed"]
}

export interface RoutesSnapshot {
  appRouterTree?: AppRouteTreeNode;
  appRoutes: RouteInfo[];
  pagesRoutes: RouteInfo[];
}
