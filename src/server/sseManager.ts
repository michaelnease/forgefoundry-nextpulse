/**
 * Server-Sent Events (SSE) Manager for NextPulse
 * Manages real-time data streaming to connected dashboard clients
 */

import type { ServerResponse } from "http";

export type SSEEventType = "runtime" | "performance" | "errors" | "bundles";

interface SSEClient {
  id: string;
  response: ServerResponse;
  eventTypes: Set<SSEEventType>;
  lastPing: number;
}

/**
 * SSE Manager - Singleton pattern for managing SSE connections
 */
class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL_MS = 30000; // 30 seconds
  private readonly CLIENT_TIMEOUT_MS = 60000; // 60 seconds

  constructor() {
    // Start ping interval to keep connections alive
    this.startPingInterval();
  }

  /**
   * Add a new SSE client
   */
  addClient(response: ServerResponse, eventTypes: SSEEventType[] = ["runtime"]): string {
    const clientId = this.generateClientId();

    // Set SSE headers
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const client: SSEClient = {
      id: clientId,
      response,
      eventTypes: new Set(eventTypes),
      lastPing: Date.now(),
    };

    this.clients.set(clientId, client);

    // Send initial connection message
    this.sendEvent(clientId, "connected", { clientId, timestamp: Date.now() });

    // Handle client disconnect
    response.on("close", () => {
      this.removeClient(clientId);
    });

    return clientId;
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Send an event to a specific client
   */
  sendEvent(clientId: string, event: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.response.write(payload);
      return true;
    } catch (error) {
      // Client connection likely closed
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Broadcast an event to all clients subscribed to a specific event type
   */
  broadcast(eventType: SSEEventType, event: string, data: any): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.eventTypes.has(eventType)) {
        if (this.sendEvent(clientId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Broadcast to all clients regardless of subscription
   */
  broadcastAll(event: string, data: any): number {
    let sentCount = 0;

    for (const clientId of this.clients.keys()) {
      if (this.sendEvent(clientId, event, data)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send ping to all clients to keep connections alive
   */
  private ping(): void {
    const now = Date.now();
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      // Check if client has timed out
      if (now - client.lastPing > this.CLIENT_TIMEOUT_MS) {
        deadClients.push(clientId);
        continue;
      }

      // Send ping
      if (this.sendEvent(clientId, "ping", { timestamp: now })) {
        client.lastPing = now;
      } else {
        deadClients.push(clientId);
      }
    }

    // Clean up dead clients
    for (const clientId of deadClients) {
      this.removeClient(clientId);
    }
  }

  /**
   * Start the ping interval
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      return;
    }

    this.pingInterval = setInterval(() => {
      this.ping();
    }, this.PING_INTERVAL_MS);
  }

  /**
   * Stop the ping interval
   */
  stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients by event type
   */
  getClientCountByEventType(eventType: SSEEventType): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.eventTypes.has(eventType)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const [clientId, client] of this.clients.entries()) {
      try {
        this.sendEvent(clientId, "shutdown", { message: "Server shutting down" });
        client.response.end();
      } catch {
        // Ignore errors during shutdown
      }
    }
    this.clients.clear();
    this.stopPingInterval();
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const sseManager = new SSEManager();
