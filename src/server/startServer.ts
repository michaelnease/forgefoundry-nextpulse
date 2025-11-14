/**
 * Local dashboard server for NextPulse
 * Runs independently from the user's Next.js app
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { exec } from "child_process";
import { loadMetadata } from "./loadMetadata.js";
import { readConfig } from "../utils/config.js";
import { scanAllRoutes } from "./routesScanner.js";
import { getRuntimeSnapshot } from "../instrumentation/sessions.js";
import { buildDiagnosticsSnapshot, buildPerformanceSnapshot } from "../diagnostics/index.js";
import { scanBundles } from "./bundleScanner.js";
import { getErrorLogSnapshot, clearErrorsAndLogs } from "../instrumentation/errors.js";
import { generateDiagnosticSnapshot } from "./snapshot.js";
import { fetchAppRuntimeSnapshot, fetchAppBundles, fetchAppErrors } from "./appRuntimeClient.js";
import { sseManager } from "./sseManager.js";
import { ChangeDetector } from "./changeDetector.js";
import pc from "picocolors";

export interface ServerOptions {
  port?: number;
  projectRoot?: string;
  openBrowser?: boolean;
}

/**
 * Get the dashboard HTML template
 */
function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NextPulse Dashboard</title>
  <style>
    :root {
      --np-bg: #F7F7F7;
      --np-surface: #E4E4E4;
      --np-border: #CFCFCF;
      --np-text-dark: #2A2A2A;
      --np-text: #4A4A4A;
      --np-highlight: #DADADA;
      --np-error: #D9534F;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--np-bg);
      color: var(--np-text);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding-top: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--np-text-dark);
    }
    .header p {
      color: var(--np-text);
      font-size: 14px;
    }
    .anvil-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--np-surface);
      color: var(--np-text-dark);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      margin: 0 auto 30px;
    }
    .anvil-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .anvil-button svg {
      width: 30px;
      height: 30px;
      display: block;
    }
    .panel {
      background: var(--np-surface);
      backdrop-filter: blur(8px);
      border: 1px solid var(--np-border);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      display: none;
    }
    .panel.visible {
      display: block;
    }
    .panel h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: var(--np-text-dark);
    }
    .metadata-item {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--np-border);
    }
    .metadata-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .metadata-label {
      font-size: 12px;
      color: var(--np-text);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .metadata-value {
      font-size: 16px;
      color: var(--np-text-dark);
      font-weight: 500;
    }
    .metadata-value.git-dirty {
      color: var(--np-error);
    }
    .metadata-value.git-clean {
      color: var(--np-text);
    }
    .status-icon {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-left: 6px;
      vertical-align: middle;
    }
    .status-icon.dirty {
      background-color: var(--np-error);
    }
    .status-icon.clean {
      background-color: var(--np-text);
    }
    .error {
      background: rgba(217, 83, 79, 0.1);
      border: 1px solid rgba(217, 83, 79, 0.3);
      border-radius: 8px;
      padding: 16px;
      color: var(--np-error);
      margin-bottom: 20px;
    }
    .loading {
      text-align: center;
      color: var(--np-text);
      padding: 40px;
    }
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--np-border);
    }
    .tab {
      padding: 8px 16px;
      background: transparent;
      border: none;
      color: var(--np-text);
      cursor: pointer;
      font-size: 14px;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab:hover {
      color: var(--np-text-dark);
    }
    .tab.active {
      color: var(--np-text-dark);
      border-bottom-color: var(--np-text-dark);
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .routes-section {
      margin-top: 24px;
    }
    .routes-summary {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      padding: 12px;
      background: var(--np-highlight);
      border-radius: 8px;
    }
    .routes-summary-item {
      font-size: 14px;
    }
    .routes-summary-label {
      color: var(--np-text);
      font-size: 12px;
      margin-bottom: 4px;
    }
    .routes-summary-value {
      color: var(--np-text-dark);
      font-weight: 600;
    }
    .routes-list {
      max-height: 400px;
      overflow-y: auto;
    }
    .route-item {
      padding: 12px;
      margin-bottom: 8px;
      background: var(--np-highlight);
      border-radius: 6px;
      border-left: 3px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
    }
    .route-item:hover {
      background: var(--np-surface);
    }
    .route-item.selected {
      border-left-color: var(--np-text-dark);
      background: var(--np-surface);
    }
    .route-path {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      color: var(--np-text-dark);
      margin-bottom: 4px;
    }
    .route-file {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      color: var(--np-text);
    }
    .route-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
      text-transform: uppercase;
    }
    .route-badge.page {
      background: var(--np-highlight);
      color: var(--np-text-dark);
    }
    .route-badge.layout {
      background: var(--np-highlight);
      color: var(--np-text-dark);
    }
    .route-badge.apiRoute {
      background: rgba(217, 83, 79, 0.2);
      color: var(--np-error);
    }
    .route-badge.routeHandler {
      background: var(--np-highlight);
      color: var(--np-text-dark);
    }
    .route-badge.loading {
      background: var(--np-highlight);
      color: var(--np-text-dark);
    }
    .route-badge.error {
      background: rgba(217, 83, 79, 0.2);
      color: var(--np-error);
    }
    .route-details {
      margin-top: 20px;
      padding: 16px;
      background: var(--np-highlight);
      border-radius: 8px;
      display: none;
    }
    .route-details.visible {
      display: block;
    }
    .route-tree {
      list-style: none;
      padding-left: 0;
    }
    .route-tree-item {
      margin-bottom: 8px;
    }
    .route-tree-segment {
      padding: 8px;
      background: var(--np-highlight);
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .route-tree-children {
      padding-left: 20px;
      margin-top: 4px;
    }
    .route-tree-icons {
      display: inline-flex;
      gap: 4px;
      margin-left: 8px;
    }
    .route-tree-icon {
      width: 16px;
      height: 16px;
      border-radius: 2px;
      display: inline-block;
      font-size: 10px;
      text-align: center;
      line-height: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NextPulse</h1>
      <p>Developer Dashboard</p>
    </div>
    
    <button class="anvil-button" id="anvilBtn" aria-label="Toggle NextPulse panel">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 18h16v2H4v-2z" fill="currentColor"/>
        <path d="M5 16h14c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1h-2V9c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H5c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1z" fill="currentColor"/>
        <path d="M9 7h6v2H9V7z" fill="currentColor"/>
      </svg>
    </button>
    
    <div class="panel" id="panel">
      <div class="loading" id="loading">Loading...</div>
      <div id="content" style="display: none;">
        <div class="tabs">
          <button class="tab active" data-tab="metadata">Metadata</button>
          <button class="tab" data-tab="routes">Routes</button>
          <button class="tab" data-tab="runtime">Runtime</button>
          <button class="tab" data-tab="performance">Performance</button>
          <button class="tab" data-tab="bundles">Bundles</button>
          <button class="tab" data-tab="errors">Errors</button>
          <button class="tab" data-tab="snapshot">Snapshot</button>
        </div>
        <div class="tab-content active" id="tab-metadata">
          <h2>Project Metadata</h2>
          <div id="metadata"></div>
        </div>
        <div class="tab-content" id="tab-routes">
          <h2>Routes</h2>
          <div id="routes-content"></div>
        </div>
        <div class="tab-content" id="tab-runtime">
          <h2>Runtime Activity</h2>
          <div id="runtime-content"></div>
        </div>
        <div class="tab-content" id="tab-performance">
          <h2>Performance Timeline</h2>
          <div id="performance-content"></div>
        </div>
        <div class="tab-content" id="tab-bundles">
          <h2>Bundles & Assets</h2>
          <div id="bundles-content"></div>
        </div>
        <div class="tab-content" id="tab-errors">
          <h2>Error & Log Center</h2>
          <div id="errors-content"></div>
        </div>
        <div class="tab-content" id="tab-snapshot">
          <h2>Diagnostic Snapshot</h2>
          <div id="snapshot-content"></div>
        </div>
      </div>
      <div id="error" class="error" style="display: none;"></div>
    </div>
  </div>
  
  <script>
    const anvilBtn = document.getElementById('anvilBtn');
    const panel = document.getElementById('panel');
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    const error = document.getElementById('error');
    const metadataDiv = document.getElementById('metadata');
    const routesContent = document.getElementById('routes-content');
    const runtimeContent = document.getElementById('runtime-content');
    const performanceContent = document.getElementById('performance-content');
    const bundlesContent = document.getElementById('bundles-content');
    const errorsContent = document.getElementById('errors-content');
    const snapshotContent = document.getElementById('snapshot-content');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    let isOpen = false;
    let routesData = null;
    let runtimeData = null;
    let runtimeEventSource = null;
    let performanceData = null;
    let performanceEventSource = null;
    let bundlesData = null;
    let bundlesInterval = null; // Keep polling for bundles (less frequent updates)
    let errorsData = null;
    let errorsEventSource = null;

    // SSE Connection Manager
    function connectSSE(url, onUpdate, onError) {
      const eventSource = new EventSource(url);

      eventSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Connected:', data.clientId);
      });

      eventSource.addEventListener('update', (e) => {
        const data = JSON.parse(e.data);
        onUpdate(data);
      });

      eventSource.addEventListener('ping', () => {
        // Keep-alive ping, no action needed
      });

      eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        if (onError) onError(err);
      };

      return eventSource;
    }

    function disconnectSSE(eventSource) {
      if (eventSource) {
        eventSource.close();
      }
      return null;
    }
    
    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(\`tab-\${tabName}\`).classList.add('active');
        
        if (tabName === 'routes' && !routesData) {
          loadRoutes();
        }
        if (tabName === 'runtime') {
          loadRuntime();
          // Start SSE for runtime updates
          if (!runtimeEventSource) {
            runtimeEventSource = connectSSE('/api/runtime/stream', (data) => {
              runtimeData = data;
              renderRuntime(data);
            });
          }
          // Stop other streams
          performanceEventSource = disconnectSSE(performanceEventSource);
          errorsEventSource = disconnectSSE(errorsEventSource);
        } else if (tabName === 'performance') {
          loadPerformance();
          // Start SSE for performance updates
          if (!performanceEventSource) {
            performanceEventSource = connectSSE('/api/performance/stream', (data) => {
              performanceData = data;
              renderPerformance(data);
            });
          }
          // Stop other streams
          runtimeEventSource = disconnectSSE(runtimeEventSource);
          errorsEventSource = disconnectSSE(errorsEventSource);
          if (bundlesInterval) {
            clearInterval(bundlesInterval);
            bundlesInterval = null;
          }
        } else if (tabName === 'bundles') {
          loadBundles();
          // Start polling for bundles (less frequent updates)
          if (bundlesInterval) clearInterval(bundlesInterval);
          bundlesInterval = setInterval(loadBundles, 3000);
          // Stop SSE streams
          runtimeEventSource = disconnectSSE(runtimeEventSource);
          performanceEventSource = disconnectSSE(performanceEventSource);
          errorsEventSource = disconnectSSE(errorsEventSource);
        } else if (tabName === 'errors') {
          loadErrors();
          // Start SSE for error updates
          if (!errorsEventSource) {
            errorsEventSource = connectSSE('/api/errors/stream', (data) => {
              errorsData = data;
              renderErrors(data);
            });
          }
          // Stop other streams
          runtimeEventSource = disconnectSSE(runtimeEventSource);
          performanceEventSource = disconnectSSE(performanceEventSource);
          if (bundlesInterval) {
            clearInterval(bundlesInterval);
            bundlesInterval = null;
          }
        } else if (tabName === 'snapshot') {
          loadSnapshot();
          // Stop all auto-refresh
          runtimeEventSource = disconnectSSE(runtimeEventSource);
          performanceEventSource = disconnectSSE(performanceEventSource);
          errorsEventSource = disconnectSSE(errorsEventSource);
          if (bundlesInterval) {
            clearInterval(bundlesInterval);
            bundlesInterval = null;
          }
        } else {
          // Stop all auto-refresh when switching away
          runtimeEventSource = disconnectSSE(runtimeEventSource);
          performanceEventSource = disconnectSSE(performanceEventSource);
          errorsEventSource = disconnectSSE(errorsEventSource);
          if (bundlesInterval) {
            clearInterval(bundlesInterval);
            bundlesInterval = null;
          }
        }
      });
    });
    
    anvilBtn.addEventListener('click', () => {
      isOpen = !isOpen;
      panel.classList.toggle('visible', isOpen);
      if (isOpen && !metadataDiv.innerHTML) {
        loadMetadata();
      }
    });
    
    async function loadMetadata() {
      try {
        loading.style.display = 'block';
        content.style.display = 'none';
        error.style.display = 'none';
        
        const [metadataRes, configRes] = await Promise.all([
          fetch('/api/metadata'),
          fetch('/api/config')
        ]);
        
        if (!metadataRes.ok) {
          throw new Error('Failed to load metadata');
        }
        
        const metadata = await metadataRes.json();
        const config = configRes.ok ? await configRes.json() : {};
        
        renderMetadata(metadata, config);
        
        loading.style.display = 'none';
        content.style.display = 'block';
      } catch (err) {
        loading.style.display = 'none';
        error.style.display = 'block';
        error.textContent = 'Failed to load metadata: ' + (err.message || 'Unknown error');
      }
    }
    
    function renderMetadata(metadata, config) {
      const branchColor = metadata.gitDirty ? 'git-dirty' : 'git-clean';
      const statusIcon = metadata.gitDirty ? '<span class="status-icon dirty"></span>' : '<span class="status-icon clean"></span>';
      
      metadataDiv.innerHTML = \`
        <div class="metadata-item">
          <div class="metadata-label">App Name</div>
          <div class="metadata-value">\${escapeHtml(metadata.appName)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Next.js Version</div>
          <div class="metadata-value">\${escapeHtml(metadata.nextVersion)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Port</div>
          <div class="metadata-value">\${escapeHtml(metadata.port)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Git Branch</div>
          <div class="metadata-value \${branchColor}">
            \${escapeHtml(metadata.gitBranch)}\${statusIcon}
            \${metadata.gitSha && metadata.gitSha !== 'unknown' ? ' (' + escapeHtml(metadata.gitSha) + ')' : ''}
          </div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Git Status</div>
          <div class="metadata-value \${branchColor}">
            \${metadata.gitDirty ? 'Dirty (uncommitted changes)' : 'Clean'}
          </div>
        </div>
        \${config.overlayPosition ? \`
        <div class="metadata-item">
          <div class="metadata-label">Overlay Position</div>
          <div class="metadata-value">\${escapeHtml(config.overlayPosition)}</div>
        </div>
        \` : ''}
      \`;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    async function loadRoutes() {
      try {
        const response = await fetch('/api/routes');
        if (!response.ok) {
          throw new Error('Failed to load routes');
        }
        routesData = await response.json();
        renderRoutes(routesData);
      } catch (err) {
        routesContent.innerHTML = \`<div class="error">Failed to load routes: \${err.message || 'Unknown error'}</div>\`;
      }
    }
    
    function renderRoutes(routes) {
      const appCount = routes.appRoutes?.length || 0;
      const pagesCount = routes.pagesRoutes?.length || 0;
      
      let html = \`
        <div class="routes-summary">
          <div class="routes-summary-item">
            <div class="routes-summary-label">App Router</div>
            <div class="routes-summary-value">\${appCount} routes</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Pages Router</div>
            <div class="routes-summary-value">\${pagesCount} routes</div>
          </div>
        </div>
      \`;
      
      if (routes.appRouterTree && routes.appRoutes.length > 0) {
        html += '<h3 style="margin-bottom: 12px; font-size: 14px; color: var(--np-text);">App Router Tree</h3>';
        html += renderAppRouterTree(routes.appRouterTree, routes.appRoutes);
      }
      
      if (routes.appRoutes.length > 0) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">App Router Routes</h3>';
        html += '<div class="routes-list">';
        routes.appRoutes.forEach(route => {
          html += renderRouteItem(route);
        });
        html += '</div>';
      }
      
      if (routes.pagesRoutes.length > 0) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Pages Router Routes</h3>';
        html += '<div class="routes-list">';
        routes.pagesRoutes.forEach(route => {
          html += renderRouteItem(route);
        });
        html += '</div>';
      }
      
      if (appCount === 0 && pagesCount === 0) {
        html += '<div style="text-align: center; color: var(--np-text); padding: 40px;">No routes found</div>';
      }
      
      routesContent.innerHTML = html;
      
      // Add click handlers for route items
      document.querySelectorAll('.route-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.route-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          const route = JSON.parse(item.dataset.route);
          showRouteDetails(route);
        });
      });
    }
    
    function renderAppRouterTree(node, allRoutes) {
      let html = '<ul class="route-tree">';
      html += renderTreeNode(node, allRoutes);
      html += '</ul>';
      return html;
    }
    
    function renderTreeNode(node, allRoutes) {
      const icons = [];
      if (node.hasPage) icons.push('<span class="route-tree-icon" style="background: var(--np-highlight); color: var(--np-text-dark);" title="Page">P</span>');
      if (node.hasLayout) icons.push('<span class="route-tree-icon" style="background: var(--np-highlight); color: var(--np-text-dark);" title="Layout">L</span>');
      if (node.hasLoading) icons.push('<span class="route-tree-icon" style="background: var(--np-highlight); color: var(--np-text-dark);" title="Loading">⏳</span>');
      if (node.hasError) icons.push('<span class="route-tree-icon" style="background: rgba(217, 83, 79, 0.2); color: var(--np-error);" title="Error">E</span>');
      if (node.hasRouteHandler) icons.push('<span class="route-tree-icon" style="background: var(--np-highlight); color: var(--np-text-dark);" title="Route Handler">R</span>');
      
      let html = '<li class="route-tree-item">';
      html += \`<div class="route-tree-segment">
        <strong>\${escapeHtml(node.segment || '/')}</strong>
        <span style="color: var(--np-text); margin-left: 8px;">\${escapeHtml(node.path)}</span>
        \${icons.length > 0 ? '<span class="route-tree-icons">' + icons.join('') + '</span>' : ''}
      </div>\`;
      
      if (node.children && node.children.length > 0) {
        html += '<ul class="route-tree-children">';
        node.children.forEach(child => {
          html += renderTreeNode(child, allRoutes);
        });
        html += '</ul>';
      }
      
      html += '</li>';
      return html;
    }
    
    function renderRouteItem(route) {
      const badgeClass = route.kind === 'apiRoute' ? 'apiRoute' : route.kind;
      return \`
        <div class="route-item" data-route="\${escapeHtml(JSON.stringify(route))}">
          <div class="route-path">
            \${escapeHtml(route.path)}
            <span class="route-badge \${badgeClass}">\${escapeHtml(route.kind)}</span>
          </div>
          <div class="route-file">\${escapeHtml(route.file)}</div>
        </div>
      \`;
    }
    
    function showRouteDetails(route) {
      let details = document.getElementById('route-details');
      if (!details) {
        details = document.createElement('div');
        details.id = 'route-details';
        details.className = 'route-details';
        routesContent.appendChild(details);
      }
      
      details.innerHTML = \`
        <h3 style="margin-bottom: 12px; font-size: 16px;">Route Details</h3>
        <div class="metadata-item">
          <div class="metadata-label">Path</div>
          <div class="metadata-value" style="font-family: monospace;">\${escapeHtml(route.path)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">File</div>
          <div class="metadata-value" style="font-family: monospace; font-size: 12px;">\${escapeHtml(route.file)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Router</div>
          <div class="metadata-value">\${escapeHtml(route.router)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Kind</div>
          <div class="metadata-value">\${escapeHtml(route.kind)}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Segment Type</div>
          <div class="metadata-value">\${escapeHtml(route.segmentType)}</div>
        </div>
      \`;
      details.classList.add('visible');
    }
    
    async function loadRuntime() {
      try {
        const response = await fetch('/api/runtime');
        const data = await response.json();
        
        if (!response.ok) {
          // Check if it's an "app unreachable" error
          if (data.error === 'next_app_unreachable') {
            runtimeContent.innerHTML = \`<div style="text-align: center; color: var(--np-text); padding: 40px;">
              <p style="margin-bottom: 12px; font-weight: 600;">Next.js dev server not reachable</p>
              <p style="font-size: 13px; color: var(--np-text);">\${escapeHtml(data.message)}</p>
              <p style="font-size: 12px; color: var(--np-text); margin-top: 16px;">Make sure <code>next dev</code> is running and <code>nextDevBaseUrl</code> in <code>nextpulse.config.json</code> is correct.</p>
            </div>\`;
            return;
          }
          throw new Error(data.message || 'Failed to load runtime data');
        }
        
        runtimeData = data;
        renderRuntime(runtimeData);
      } catch (err) {
        runtimeContent.innerHTML = \`<div class="error">Failed to load runtime data: \${err.message || 'Unknown error'}</div>\`;
      }
    }
    
    function renderRuntime(snapshot) {
      // Check if snapshot has sessions
      if (!snapshot || !snapshot.sessions || snapshot.sessions.length === 0) {
        runtimeContent.innerHTML = '<div style="text-align: center; color: var(--np-text); padding: 40px;">Waiting for data... Open your app in another tab and generate some traffic.</div>';
        return;
      }
      
      const activeSession = snapshot.activeSessionId
        ? snapshot.sessions.find(s => s.id === snapshot.activeSessionId)
        : null;
      
      let html = '';
      
      if (activeSession) {
        const duration = activeSession.finishedAt
          ? ((activeSession.finishedAt - activeSession.startedAt) / 1000).toFixed(2) + 's'
          : 'active';
        
        html += \`
          <div class="routes-summary">
            <div class="routes-summary-item">
              <div class="routes-summary-label">Active Session</div>
              <div class="routes-summary-value">\${escapeHtml(activeSession.route)}</div>
            </div>
            <div class="routes-summary-item">
              <div class="routes-summary-label">Duration</div>
              <div class="routes-summary-value">\${duration}</div>
            </div>
            <div class="routes-summary-item">
              <div class="routes-summary-label">Fetches</div>
              <div class="routes-summary-value">\${activeSession.fetches.length}</div>
            </div>
            <div class="routes-summary-item">
              <div class="routes-summary-label">Actions</div>
              <div class="routes-summary-value">\${activeSession.actions.length}</div>
            </div>
          </div>
        \`;
        
        if (activeSession.fetches.length > 0) {
          html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Fetches</h3>';
          html += '<div class="routes-list">';
          activeSession.fetches.forEach(fetch => {
            const statusColor = fetch.statusCode >= 200 && fetch.statusCode < 300 ? 'var(--np-text-dark)' : fetch.statusCode >= 400 ? 'var(--np-error)' : 'var(--np-text)';
            html += \`
              <div class="route-item">
                <div class="route-path">
                  <span style="color: \${statusColor};">\${escapeHtml(fetch.method)} \${fetch.statusCode || '...'}</span>
                  <span style="color: var(--np-text); margin-left: 8px;">\${fetch.durationMs}ms</span>
                </div>
                <div class="route-file">\${escapeHtml(fetch.url)}</div>
                <div style="font-size: 10px; color: var(--np-text); margin-top: 4px;">
                  \${fetch.origin} | \${fetch.cacheResult || 'unknown'} cache
                </div>
              </div>
            \`;
          });
          html += '</div>';
        }
        
        if (activeSession.actions.length > 0) {
          html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Server Actions</h3>';
          html += '<div class="routes-list">';
          activeSession.actions.forEach(action => {
            const statusColor = action.status === 'success' ? 'var(--np-text-dark)' : 'var(--np-error)';
            html += \`
              <div class="route-item">
                <div class="route-path">
                  <span style="color: \${statusColor};">\${escapeHtml(action.name)}</span>
                  <span style="color: var(--np-text); margin-left: 8px;">\${action.executionTimeMs}ms</span>
                </div>
                \${action.file ? \`<div class="route-file">\${escapeHtml(action.file)}</div>\` : ''}
                \${action.errorMessage ? \`<div style="font-size: 10px; color: var(--np-error); margin-top: 4px;">\${escapeHtml(action.errorMessage)}</div>\` : ''}
              </div>
            \`;
          });
          html += '</div>';
        }
      } else {
        html += '<div style="text-align: center; color: var(--np-text); padding: 40px;">No active session</div>';
      }
      
      if (snapshot.sessions.length > 1) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Recent Sessions</h3>';
        html += '<div class="routes-list">';
        snapshot.sessions.slice(0, 10).forEach(session => {
          if (session.id === snapshot.activeSessionId) return;
          const duration = session.finishedAt
            ? ((session.finishedAt - session.startedAt) / 1000).toFixed(2) + 's'
            : 'active';
          html += \`
            <div class="route-item">
              <div class="route-path">\${escapeHtml(session.route)}</div>
              <div style="font-size: 10px; color: var(--np-text);">
                \${duration} | \${session.fetches.length} fetches | \${session.actions.length} actions
              </div>
            </div>
          \`;
        });
        html += '</div>';
      }
      
      runtimeContent.innerHTML = html;
    }
    
    async function loadPerformance() {
      try {
        const response = await fetch('/api/performance');
        const data = await response.json();
        
        if (!response.ok) {
          // Check if it's an "app unreachable" error
          if (data.error === 'next_app_unreachable') {
            performanceContent.innerHTML = \`<div style="text-align: center; color: var(--np-text); padding: 40px;">
              <p style="margin-bottom: 12px; font-weight: 600;">Next.js dev server not reachable</p>
              <p style="font-size: 13px; color: var(--np-text);">\${escapeHtml(data.message)}</p>
              <p style="font-size: 12px; color: var(--np-text); margin-top: 16px;">Make sure <code>next dev</code> is running and <code>nextDevBaseUrl</code> in <code>nextpulse.config.json</code> is correct.</p>
            </div>\`;
            return;
          }
          throw new Error(data.message || 'Failed to load performance data');
        }
        
        performanceData = data;
        renderPerformance(performanceData);
      } catch (err) {
        performanceContent.innerHTML = \`<div class="error">Failed to load performance data: \${err.message || 'Unknown error'}</div>\`;
      }
    }
    
    function renderPerformance(data) {
      if (!data || !data.sessions || data.sessions.length === 0) {
        performanceContent.innerHTML = '<div style="text-align: center; color: var(--np-text); padding: 40px;">Waiting for data... Open your app in another tab and generate some traffic.</div>';
        return;
      }
      
      const activeSession = data.activeSessionId
        ? data.sessions.find(s => s.id === data.activeSessionId)
        : null;
      
      if (!activeSession) {
        performanceContent.innerHTML = '<div style="text-align: center; color: var(--np-text); padding: 40px;">No active session</div>';
        return;
      }
      
      const metrics = activeSession.metrics || {};
      const waterfalls = activeSession.waterfalls || [];
      const timeline = activeSession.timeline || [];
      
      // Calculate timeline bounds
      const sessionStart = activeSession.startedAt;
      const sessionEnd = activeSession.finishedAt || Date.now();
      const sessionDuration = sessionEnd - sessionStart;
      
      let html = \`
        <div class="routes-summary">
          <div class="routes-summary-item">
            <div class="routes-summary-label">Total Render Time</div>
            <div class="routes-summary-value">\${(metrics.totalServerRenderTime / 1000).toFixed(2)}s</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Streaming Time</div>
            <div class="routes-summary-value">\${(metrics.totalStreamingTime / 1000).toFixed(2)}s</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Slowest RSC</div>
            <div class="routes-summary-value">\${metrics.slowestRscComponent ? (metrics.slowestRscComponent.durationMs + 'ms') : 'N/A'}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Suspense Boundaries</div>
            <div class="routes-summary-value">\${metrics.suspenseBoundaryCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Waterfalls</div>
            <div class="routes-summary-value" style="color: \${waterfalls.length > 0 ? 'var(--np-error)' : 'var(--np-text-dark)'}">\${waterfalls.length}</div>
          </div>
        </div>
      \`;
      
      if (waterfalls.length > 0) {
        html += '<div style="margin-top: 20px; padding: 12px; background: rgba(217, 83, 79, 0.1); border: 1px solid rgba(217, 83, 79, 0.3); border-radius: 8px; margin-bottom: 20px;">';
        html += '<strong style="color: var(--np-error);">⚠ Waterfalls Detected</strong>';
        waterfalls.forEach((waterfall, idx) => {
          html += \`<div style="margin-top: 8px; font-size: 12px; color: var(--np-error);">
            \${waterfall.type.toUpperCase()} waterfall: \${waterfall.events.length} serial operations, \${(waterfall.totalDuration / 1000).toFixed(2)}s total
          </div>\`;
        });
        html += '</div>';
      }
      
      if (timeline.length > 0 && sessionDuration > 0) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Timeline</h3>';
        html += '<div style="position: relative; height: \${Math.max(200, timeline.length * 30)}px; background: var(--np-highlight); border-radius: 8px; padding: 12px; overflow-x: auto;">';
        
        // Create timeline rows - use grayscale colors
        const eventTypes = ['rsc', 'suspense', 'streaming', 'fetch', 'action'];
        const colors = {
          rsc: '#6B6B6B',
          suspense: '#8B8B8B',
          streaming: '#7B7B7B',
          fetch: '#5B5B5B',
          action: 'var(--np-error)',
        };
        
        eventTypes.forEach((type) => {
          const events = timeline.filter(e => e.type === type);
          if (events.length === 0) return;
          
          html += \`<div style="margin-bottom: 8px;">
            <div style="font-size: 11px; color: var(--np-text); margin-bottom: 4px; text-transform: uppercase;">\${type}</div>
            <div style="position: relative; height: 20px; background: var(--np-highlight); border-radius: 4px;">
          \`;
          
          events.forEach((event) => {
            const offset = ((event.timestamp - sessionStart) / sessionDuration) * 100;
            const width = event.durationMs ? (event.durationMs / sessionDuration) * 100 : 2;
            html += \`
              <div style="
                position: absolute;
                left: \${offset}%;
                width: \${Math.max(width, 1)}%;
                height: 100%;
                background: \${colors[type]};
                border-radius: 4px;
                opacity: 0.8;
                min-width: 2px;
              " title="\${type} - \${event.durationMs ? event.durationMs + 'ms' : 'marker'}"></div>
            \`;
          });
          
          html += '</div></div>';
        });
        
        html += '</div>';
      } else {
        html += '<div style="text-align: center; color: var(--np-text); padding: 40px;">No timeline data available</div>';
      }
      
      performanceContent.innerHTML = html;
    }
    
    async function loadBundles() {
      try {
        const response = await fetch('/api/bundles');
        if (!response.ok) {
          if (response.status === 404) {
            bundlesContent.innerHTML = '<div style="text-align: center; color: var(--np-text); padding: 40px;">No build output found. Run <code>next build</code> first.</div>';
            return;
          }
          throw new Error('Failed to load bundle data');
        }
        bundlesData = await response.json();
        renderBundles(bundlesData);
      } catch (err) {
        bundlesContent.innerHTML = \`<div class="error">Failed to load bundle data: \${err.message || 'Unknown error'}</div>\`;
      }
    }
    
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    function renderBundles(data) {
      if (!data) {
        bundlesContent.innerHTML = '<div style="text-align: center; color: var(--np-text); padding: 40px;">No bundle data available</div>';
        return;
      }
      
      // High-level totals
      const largestChunks = [...data.chunks].sort((a, b) => b.size - a.size).slice(0, 5);
      const largestAssets = [...data.assets].sort((a, b) => b.size - a.size).slice(0, 5);
      
      let html = \`
        <div class="routes-summary">
          <div class="routes-summary-item">
            <div class="routes-summary-label">Total Client Size</div>
            <div class="routes-summary-value">\${formatBytes(data.totalClientSize)}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Total Server Size</div>
            <div class="routes-summary-value">\${formatBytes(data.totalServerSize)}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Total Assets</div>
            <div class="routes-summary-value">\${data.assets.length}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Total Chunks</div>
            <div class="routes-summary-value">\${data.chunks.length}</div>
          </div>
        </div>
      \`;
      
      // Largest chunks
      if (largestChunks.length > 0) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Largest Chunks</h3>';
        html += '<div class="routes-list">';
        largestChunks.forEach(chunk => {
          const isLarge = chunk.size > 500 * 1024; // 500KB
          html += \`
            <div class="route-item" style="border-left: 3px solid \${isLarge ? 'var(--np-error)' : 'var(--np-border)'}">
              <div class="route-path">
                <span>\${escapeHtml(chunk.name)}</span>
                <span style="color: var(--np-text); margin-left: 8px;">\${formatBytes(chunk.size)}</span>
                \${chunk.gzipSize ? \`<span style="color: var(--np-text); margin-left: 8px;">(\${formatBytes(chunk.gzipSize)} gzip)</span>\` : ''}
              </div>
              <div style="font-size: 10px; color: var(--np-text); margin-top: 4px;">
                \${chunk.isEntry ? 'Entry' : ''} \${chunk.isDynamic ? 'Dynamic' : ''} \${chunk.isShared ? 'Shared' : ''}
              </div>
            </div>
          \`;
        });
        html += '</div>';
      }
      
      // Route mapping
      if (data.routeMapping && data.routeMapping.length > 0) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Route Bundle Sizes</h3>';
        html += '<div class="routes-list">';
        data.routeMapping.forEach(route => {
          html += \`
            <div class="route-item">
              <div class="route-path">
                <span>\${escapeHtml(route.route)}</span>
              </div>
              <div style="font-size: 10px; color: var(--np-text); margin-top: 4px;">
                Client: \${formatBytes(route.totalClientSize)} | Server: \${formatBytes(route.totalServerSize)} | Chunks: \${route.clientChunks.length + route.serverChunks.length}
              </div>
            </div>
          \`;
        });
        html += '</div>';
      }
      
      // Assets table (top 20)
      if (data.assets && data.assets.length > 0) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Largest Assets</h3>';
        html += '<div class="routes-list">';
        largestAssets.forEach(asset => {
          html += \`
            <div class="route-item">
              <div class="route-path">
                <span>\${escapeHtml(asset.name)}</span>
                <span style="color: var(--np-text); margin-left: 8px;">\${formatBytes(asset.size)}</span>
                \${asset.gzipSize ? \`<span style="color: var(--np-text); margin-left: 8px;">(\${formatBytes(asset.gzipSize)} gzip)</span>\` : ''}
              </div>
              <div style="font-size: 10px; color: var(--np-text); margin-top: 4px;">
                \${asset.type} | \${asset.isClient ? 'Client' : ''} \${asset.isServer ? 'Server' : ''} \${asset.isShared ? 'Shared' : ''}
              </div>
            </div>
          \`;
        });
        html += '</div>';
      }
      
      bundlesContent.innerHTML = html;
    }
    
    async function loadErrors() {
      try {
        const response = await fetch('/api/errors');
        if (!response.ok) {
          throw new Error('Failed to load error data');
        }
        errorsData = await response.json();
        renderErrors(errorsData);
      } catch (err) {
        errorsContent.innerHTML = \`<div class="error">Failed to load error data: \${err.message || 'Unknown error'}</div>\`;
      }
    }
    
    function formatTimeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return \`\${seconds}s ago\`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return \`\${minutes}m ago\`;
      const hours = Math.floor(minutes / 60);
      return \`\${hours}h ago\`;
    }
    
    function renderErrors(data) {
      if (!data) {
        errorsContent.innerHTML = '<div style="text-align: center; color: var(--np-text); padding: 40px;">No error data available</div>';
        return;
      }
      
      const errors = data.errors || [];
      const logs = data.logs || [];
      
      // Calculate summary
      const errorCount = errors.filter(e => e.severity === 'error').length;
      const warningCount = errors.filter(e => e.severity === 'warning').length;
      const infoCount = logs.filter(l => l.level === 'info').length;
      const affectedRoutes = new Set(errors.map(e => e.route).filter(Boolean)).size;
      
      let html = \`
        <div class="routes-summary">
          <div class="routes-summary-item">
            <div class="routes-summary-label">Total Errors</div>
            <div class="routes-summary-value" style="color: var(--np-error);">\${errorCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Warnings</div>
            <div class="routes-summary-value" style="color: var(--np-text-dark);">\${warningCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Info Logs</div>
            <div class="routes-summary-value">\${infoCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Affected Routes</div>
            <div class="routes-summary-value">\${affectedRoutes}</div>
          </div>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 12px;">
          <button onclick="clearErrors()" style="padding: 8px 16px; background: var(--np-error); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Clear All</button>
        </div>
      \`;
      
      // Error list
      if (errors.length > 0) {
        html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Recent Errors</h3>';
        html += '<div class="routes-list">';
        errors.slice(0, 20).forEach((error, idx) => {
          const severityColor = error.severity === 'error' ? 'var(--np-error)' : error.severity === 'warning' ? 'var(--np-text-dark)' : 'var(--np-text)';
          html += \`
            <div class="route-item" style="border-left: 3px solid \${severityColor}; cursor: pointer;" onclick="toggleErrorDetails('\${error.id}')">
              <div class="route-path">
                <span style="color: \${severityColor}; font-weight: 600;">\${error.severity.toUpperCase()}</span>
                <span style="color: var(--np-text); margin-left: 8px;">\${formatTimeAgo(error.timestamp)}</span>
                <span style="color: var(--np-text); margin-left: 8px;">\${escapeHtml(error.source)}</span>
              </div>
              <div style="font-size: 11px; color: var(--np-text-dark); margin-top: 4px;">
                \${escapeHtml(error.route || 'unknown route')}
              </div>
              <div style="font-size: 11px; color: var(--np-text); margin-top: 4px;">
                \${escapeHtml(error.message)}
              </div>
              <div id="error-details-\${error.id}" style="display: none; margin-top: 8px; padding: 8px; background: var(--np-highlight); border-radius: 4px; font-size: 10px; font-family: monospace; white-space: pre-wrap; color: var(--np-text);">
                \${error.stack ? escapeHtml(error.stack) : 'No stack trace available'}
                \${error.meta ? '<br><br>Meta: ' + escapeHtml(JSON.stringify(error.meta, null, 2)) : ''}
              </div>
            </div>
          \`;
        });
        html += '</div>';
      } else {
        html += '<div style="text-align: center; color: var(--np-text); padding: 40px;">No errors recorded</div>';
      }
      
      errorsContent.innerHTML = html;
    }
    
    function toggleErrorDetails(errorId) {
      const details = document.getElementById(\`error-details-\${errorId}\`);
      if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
      }
    }
    
    async function clearErrors() {
      try {
        const response = await fetch('/api/errors?clear=true');
        if (response.ok) {
          loadErrors();
        }
      } catch (err) {
        console.error('Failed to clear errors:', err);
      }
    }
    
    async function loadSnapshot() {
      try {
        const response = await fetch('/api/snapshot');
        if (!response.ok) {
          throw new Error('Failed to load snapshot');
        }
        const snapshot = await response.json();
        renderSnapshot(snapshot);
      } catch (err) {
        snapshotContent.innerHTML = \`<div class="error">Failed to load snapshot: \${err.message || 'Unknown error'}</div>\`;
      }
    }
    
    function renderSnapshot(snapshot) {
      if (!snapshot) {
        snapshotContent.innerHTML = '<div style="text-align: center; color: var(--np-text); padding: 40px;">No snapshot data available</div>';
        return;
      }
      
      // Summary
      const routeCount = (snapshot.routes?.appRoutes?.length || 0) + (snapshot.routes?.pagesRoutes?.length || 0);
      const bundleCount = snapshot.bundles?.assets?.length || 0;
      const errorCount = snapshot.errors?.errors?.length || 0;
      const sessionCount = snapshot.runtime?.sessions?.length || 0;
      const totalClientSize = snapshot.bundles?.totalClientSize || 0;
      const totalServerSize = snapshot.bundles?.totalServerSize || 0;
      
      let html = \`
        <div style="margin-bottom: 24px;">
          <p style="color: var(--np-text); font-size: 14px; margin-bottom: 20px;">
            This is a complete diagnostic profile for AI analysis. Export the snapshot to share with AI assistants or for debugging.
          </p>
          <button onclick="exportSnapshot()" style="padding: 12px 24px; background: var(--np-text-dark); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
            Export Snapshot
          </button>
        </div>
        
        <div class="routes-summary">
          <div class="routes-summary-item">
            <div class="routes-summary-label">Routes</div>
            <div class="routes-summary-value">\${routeCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Bundles</div>
            <div class="routes-summary-value">\${bundleCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Errors</div>
            <div class="routes-summary-value" style="color: \${errorCount > 0 ? 'var(--np-error)' : 'var(--np-text-dark)'}">\${errorCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Sessions</div>
            <div class="routes-summary-value">\${sessionCount}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Client Size</div>
            <div class="routes-summary-value">\${formatBytes(totalClientSize)}</div>
          </div>
          <div class="routes-summary-item">
            <div class="routes-summary-label">Server Size</div>
            <div class="routes-summary-value">\${formatBytes(totalServerSize)}</div>
          </div>
        </div>
        
        <h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; color: var(--np-text);">Snapshot Preview</h3>
        <div style="background: var(--np-highlight); border-radius: 8px; padding: 16px; max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 11px; color: var(--np-text);">
          <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">\${escapeHtml(JSON.stringify(snapshot, null, 2).substring(0, 2000))}...</pre>
        </div>
      \`;
      
      snapshotContent.innerHTML = html;
    }
    
    async function exportSnapshot() {
      try {
        const response = await fetch('/api/snapshot');
        if (!response.ok) {
          throw new Error('Failed to export snapshot');
        }
        const snapshot = await response.json();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`nextpulse-snapshot-\${snapshot.timestamp}.json\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Failed to export snapshot: ' + (err.message || 'Unknown error'));
      }
    }
    
    // Auto-open panel on load
  </script>
</body>
</html>`;
}

/**
 * Handle API routes
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string
): Promise<void> {
  // Load config to get nextDevBaseUrl
  const config = readConfig(projectRoot);
  const nextDevBaseUrl = config.nextDevBaseUrl || "http://localhost:3000";
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Metadata endpoint
  if (url.pathname === "/api/metadata") {
    try {
      const metadata = loadMetadata(projectRoot);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metadata));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to load metadata",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // Config endpoint
  if (url.pathname === "/api/config") {
    try {
      const config = readConfig(projectRoot);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(config));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to load config",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // Routes endpoint
  if (url.pathname === "/api/routes") {
    try {
      const routes = scanAllRoutes(projectRoot);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(routes));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to scan routes",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // SSE Stream: Runtime data stream
  if (url.pathname === "/api/runtime/stream") {
    sseManager.addClient(res, ["runtime"]);
    // Connection stays open, response is handled by SSE manager
    return;
  }

  // SSE Stream: Performance data stream
  if (url.pathname === "/api/performance/stream") {
    sseManager.addClient(res, ["performance"]);
    // Connection stays open, response is handled by SSE manager
    return;
  }

  // SSE Stream: Errors data stream
  if (url.pathname === "/api/errors/stream") {
    sseManager.addClient(res, ["errors"]);
    // Connection stays open, response is handled by SSE manager
    return;
  }

  // Runtime endpoint - fetch from Next.js app, fallback to local
  if (url.pathname === "/api/runtime") {
    try {
      const appRuntime = await fetchAppRuntimeSnapshot(nextDevBaseUrl);
      if (appRuntime) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(appRuntime));
        return;
      }
      // App not reachable - fallback to local runtime snapshot
      const localRuntime = getRuntimeSnapshot();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(localRuntime));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to get runtime snapshot",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // Performance endpoint - fetch runtime from Next.js app and build performance from it, fallback to local
  if (url.pathname === "/api/performance") {
    try {
      const appRuntime = await fetchAppRuntimeSnapshot(nextDevBaseUrl);
      if (appRuntime) {
        // Build performance snapshot from the app's runtime data
        const performance = buildPerformanceSnapshot(appRuntime);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(performance));
        return;
      }
      // App not reachable - fallback to local runtime snapshot
      const localRuntime = getRuntimeSnapshot();
      const performance = buildPerformanceSnapshot(localRuntime);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(performance));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to get performance data",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // Bundles endpoint - fetch from Next.js app if available, otherwise scan locally
  if (url.pathname === "/api/bundles") {
    try {
      // Try to fetch from Next.js app first
      const appBundles = await fetchAppBundles(nextDevBaseUrl);
      if (appBundles) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(appBundles));
        return;
      }
      // Fallback to local scan
      const bundles = scanBundles(projectRoot);
      if (!bundles) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "No build output found",
            message: ".next directory not found. Run 'next build' first.",
          })
        );
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(bundles));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to scan bundles",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // Errors endpoint - fetch from Next.js app if available, otherwise use local snapshot
  if (url.pathname === "/api/errors") {
    try {
      if (url.searchParams.get("clear") === "true") {
        // Clear is handled locally for now (could be forwarded to Next.js app in future)
        clearErrorsAndLogs();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // Try to fetch from Next.js app first
      const appErrors = await fetchAppErrors(nextDevBaseUrl);
      if (appErrors) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(appErrors));
        return;
      }
      // Fallback to local snapshot
      const snapshot = getErrorLogSnapshot();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(snapshot));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to get error log snapshot",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // Snapshot endpoint
  if (url.pathname === "/api/snapshot") {
    try {
      const snapshot = await generateDiagnosticSnapshot(projectRoot);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(snapshot, null, 2));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to generate diagnostic snapshot",
          message: error?.message || "Unknown error",
        })
      );
    }
    return;
  }

  // Dashboard HTML
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getDashboardHTML());
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
}

/**
 * Try to open browser silently (no warnings on failure)
 */
function tryOpenBrowser(url: string): void {
  exec(`xdg-open "${url}"`, (err) => {
    // Completely ignore all errors. Do not log anything.
  });
}

/**
 * Start the dashboard server
 */
export function startServer(options: ServerOptions = {}): Promise<void> {
  return new Promise((promiseResolve, promiseReject) => {
    const port = options.port || 4337;
    const projectRoot = options.projectRoot || process.cwd();
    const shouldOpen = options.openBrowser !== false;

    // Resolve project root to absolute path
    const resolvedRoot = resolve(projectRoot);

    // Verify project root exists
    if (!existsSync(resolvedRoot)) {
      console.log(
        pc.yellow(
          `[nextpulse] Warning: Project root "${resolvedRoot}" does not exist. Server will start but metadata may be incomplete.`
        )
      );
    }

    const server = createServer((req, res) => {
      handleRequest(req, res, resolvedRoot).catch((error) => {
        console.error(pc.red(`[nextpulse] Server error: ${error.message}`));
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      });
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          pc.red(
            `[nextpulse] Port ${port} is already in use. Please choose a different port with --port.`
          )
        );
        promiseReject(new Error(`Port ${port} is already in use`));
      } else {
        console.error(pc.red(`[nextpulse] Server error: ${error.message}`));
        promiseReject(error);
      }
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(pc.green(`[nextpulse] Dashboard server running at ${url}`));
      console.log(pc.dim(`[nextpulse] Project root: ${resolvedRoot}`));

      // Start change detector for real-time SSE updates
      const config = readConfig(resolvedRoot);
      const nextDevBaseUrl = config.nextDevBaseUrl || "http://localhost:3000";
      const changeDetector = new ChangeDetector({
        nextDevBaseUrl,
        pollInterval: 1000, // Check for changes every second
        debug: false,
      });
      changeDetector.start();
      console.log(pc.dim("[nextpulse] SSE change detector started"));

      // Cleanup on process exit
      const cleanup = () => {
        changeDetector.stop();
        sseManager.closeAll();
      };
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      if (shouldOpen) {
        tryOpenBrowser(url);
      }

      promiseResolve();
    });
  });
}
