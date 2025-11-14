/**
 * NextPulse Constants and Configuration Defaults
 * Centralized location for all magic numbers and default values
 */

/**
 * Session Management
 */
export const SESSION_LIMITS = {
  /** Maximum number of sessions to keep in memory */
  MAX_SESSIONS: 50,
} as const;

/**
 * Error and Log Management
 */
export const ERROR_LIMITS = {
  /** Maximum number of errors to keep in memory */
  MAX_ERRORS: 100,
  /** Maximum number of logs to keep in memory */
  MAX_LOGS: 200,
} as const;

/**
 * Server Configuration
 */
export const SERVER_DEFAULTS = {
  /** Default port for NextPulse dashboard server */
  DEFAULT_DASHBOARD_PORT: 4337,
  /** Default Next.js dev server URL */
  DEFAULT_NEXT_DEV_URL: "http://localhost:3000",
  /** Default Next.js dev server port */
  DEFAULT_NEXT_DEV_PORT: 3000,
} as const;

/**
 * API Timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  /** Timeout for fetching runtime data from Next.js app */
  RUNTIME_FETCH_TIMEOUT: 2000, // 2 seconds
  /** Default request timeout */
  DEFAULT_REQUEST_TIMEOUT: 5000, // 5 seconds
} as const;

/**
 * Polling Intervals (in milliseconds)
 */
export const POLLING_INTERVALS = {
  /** Interval for polling runtime data in dashboard */
  RUNTIME_POLL_INTERVAL: 2000, // 2 seconds
  /** Interval for polling bundle data in dashboard */
  BUNDLES_POLL_INTERVAL: 5000, // 5 seconds
  /** Interval for polling error data in dashboard */
  ERRORS_POLL_INTERVAL: 2000, // 2 seconds
  /** Interval for polling performance data in dashboard */
  PERFORMANCE_POLL_INTERVAL: 1000, // 1 second
} as const;

/**
 * Performance Thresholds (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Threshold for slow fetch requests */
  SLOW_FETCH_MS: 1000, // 1 second
  /** Threshold for slow RSC renders */
  SLOW_RSC_MS: 500, // 500ms
  /** Threshold for slow server actions */
  SLOW_ACTION_MS: 1000, // 1 second
} as const;

/**
 * Bundle Size Thresholds (in bytes)
 */
export const BUNDLE_THRESHOLDS = {
  /** Threshold for large chunks */
  LARGE_CHUNK_BYTES: 500 * 1024, // 500KB
  /** Threshold for warning on total bundle size */
  WARNING_TOTAL_BYTES: 1024 * 1024, // 1MB
} as const;

/**
 * File Patterns
 */
export const FILE_PATTERNS = {
  /** Extensions for TypeScript/JavaScript files */
  TS_JS_EXTENSIONS: /\.(ts|tsx|js|jsx)$/,
  /** Extensions for Next.js page files */
  PAGE_EXTENSIONS: /\.(ts|tsx|js|jsx)$/,
  /** Pattern for dynamic route segments */
  DYNAMIC_ROUTE_SEGMENT: /^\[.*\]$/,
  /** Pattern for catch-all route segments */
  CATCH_ALL_SEGMENT: /^\[\.\.\..*\]$/,
} as const;

/**
 * Environment Detection
 */
export const ENV = {
  /** Check if running in development mode */
  isDevelopment: () => process.env.NODE_ENV === "development",
  /** Check if running in production mode */
  isProduction: () => process.env.NODE_ENV === "production",
  /** Check if running in test mode */
  isTest: () => process.env.NODE_ENV === "test",
} as const;

/**
 * Log Prefixes
 */
export const LOG_PREFIXES = {
  INFO: "[nextpulse]",
  ERROR: "[nextpulse] error:",
  WARN: "[nextpulse] warn:",
  SUCCESS: "[nextpulse] ✓",
} as const;

/**
 * NextPulse Config File
 */
export const CONFIG_FILE = {
  /** Name of the config file */
  NAME: "nextpulse.config.json",
  /** Default overlay position */
  DEFAULT_OVERLAY_POSITION: "bottomRight" as const,
  /** Default open browser setting */
  DEFAULT_OPEN_BROWSER: true,
} as const;

/**
 * Cache Detection
 */
export const CACHE_HEADERS = {
  /** Cache-related headers to check */
  CACHE_CONTROL: "cache-control",
  AGE: "age",
  EXPIRES: "expires",
  CF_CACHE_STATUS: "cf-cache-status",
  X_CACHE: "x-cache",
  X_VERCEL_CACHE: "x-vercel-cache",
} as const;

/**
 * Error Retry Configuration
 */
export const RETRY_CONFIG = {
  /** Maximum number of retries for failed operations */
  MAX_RETRIES: 3,
  /** Initial retry delay in milliseconds */
  INITIAL_RETRY_DELAY: 1000,
  /** Backoff multiplier for retries */
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Dashboard UI Configuration
 */
export const DASHBOARD_UI = {
  /** Maximum number of recent fetches to display */
  MAX_RECENT_FETCHES: 5,
  /** Maximum number of recent server actions to display */
  MAX_RECENT_ACTIONS: 5,
  /** Maximum number of timeline entries per session */
  MAX_TIMELINE_ENTRIES: 100,
} as const;
