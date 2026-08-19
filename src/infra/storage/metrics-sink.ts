/**
 * SQLite Metrics Sink for Telemetry, Token Budgets, and Execution Stats.
 *
 * Implements append-only telemetry persistence, session aggregation queries,
 * and JSON export capabilities.
 */
import type { SqliteStore } from './sqlite-store.js';

export interface MetricRecord {
  readonly id: number;
  readonly sessionId?: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly createdAt: number;
}

export interface SessionMetricsAggregation {
  readonly sessionId: string;
  readonly totalTokens: number;
  readonly totalCostDollars: number;
  readonly eventCounts: Record<string, number>;
  readonly firstEventTime?: number;
  readonly lastEventTime?: number;
}

export interface SqliteMetricsSinkOptions {
  readonly store: SqliteStore;
}

export class SqliteMetricsSink {
  private readonly store: SqliteStore;

  constructor(options: SqliteMetricsSinkOptions) {
    this.store = options.store;
  }

  /**
   * Record a telemetry metric event.
   */
  async recordMetric(
    sessionId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
    createdAt?: number,
  ): Promise<void> {
    const db = this.store.db;
    const now = createdAt ?? Date.now();
    const serialized = JSON.stringify(payload);

    db.prepare(
      'INSERT INTO metrics (session_id, event_type, payload, created_at) VALUES (?, ?, ?, ?)',
    ).run(sessionId, eventType, serialized, now);
  }

  /**
   * Retrieve all metrics for a given session.
   */
  async getSessionMetrics(sessionId: string): Promise<MetricRecord[]> {
    const db = this.store.db;
    const rows = db
      .prepare(
        'SELECT id, session_id, event_type, payload, created_at FROM metrics WHERE session_id = ? ORDER BY created_at ASC',
      )
      .all(sessionId) as any[];

    return rows.map((r) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(r.payload);
      } catch {
        // Ignore parse error
      }
      return {
        id: r.id,
        sessionId: r.session_id ?? undefined,
        eventType: r.event_type,
        payload,
        createdAt: r.created_at,
      };
    });
  }

  /**
   * Aggregate total tokens, cost, and event frequencies for a session.
   */
  async aggregateSessionTotals(sessionId: string): Promise<SessionMetricsAggregation> {
    const metrics = await this.getSessionMetrics(sessionId);

    let totalTokens = 0;
    let totalCostDollars = 0;
    const eventCounts: Record<string, number> = {};
    let firstEventTime: number | undefined;
    let lastEventTime: number | undefined;

    for (const m of metrics) {
      eventCounts[m.eventType] = (eventCounts[m.eventType] ?? 0) + 1;

      if (!firstEventTime || m.createdAt < firstEventTime) firstEventTime = m.createdAt;
      if (!lastEventTime || m.createdAt > lastEventTime) lastEventTime = m.createdAt;

      if (typeof m.payload['tokens'] === 'number') {
        totalTokens += m.payload['tokens'];
      } else if (typeof m.payload['totalTokens'] === 'number') {
        totalTokens += m.payload['totalTokens'];
      }

      if (typeof m.payload['costDollars'] === 'number') {
        totalCostDollars += m.payload['costDollars'];
      }
    }

    return {
      sessionId,
      totalTokens,
      totalCostDollars: Number(totalCostDollars.toFixed(4)),
      eventCounts,
      firstEventTime,
      lastEventTime,
    };
  }

  /**
   * Export metrics records matching filter as JSON string.
   */
  async exportMetricsJson(filter?: { sessionId?: string; since?: number }): Promise<string> {
    const db = this.store.db;
    let query = 'SELECT id, session_id, event_type, payload, created_at FROM metrics WHERE 1=1';
    const params: any[] = [];

    if (filter?.sessionId) {
      query += ' AND session_id = ?';
      params.push(filter.sessionId);
    }
    if (filter?.since) {
      query += ' AND created_at >= ?';
      params.push(filter.since);
    }

    query += ' ORDER BY created_at ASC';
    const rows = db.prepare(query).all(...params) as any[];

    const result = rows.map((r) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(r.payload);
      } catch {
        // Ignore parse error
      }
      return {
        id: r.id,
        sessionId: r.session_id,
        eventType: r.event_type,
        payload,
        createdAt: r.created_at,
      };
    });

    return JSON.stringify(result, null, 2);
  }
}
