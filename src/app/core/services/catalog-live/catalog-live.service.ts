import { Injectable, NgZone, inject } from '@angular/core';
import { EMPTY, Observable, Subject, buffer, catchError, debounceTime, filter, map, share, switchMap } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';

/** What changed: the product ids, or null when any product may have (a category, a country, a bundle). */
export interface CatalogChange {
  productIds: string[] | null;
}

/**
 * Live storefront: the server says "CatalogChanged" on /catalogHub whenever the admin saves a
 * product, a price or an offer (or an order moves stock), and every page subscribed here reloads
 * its data quietly — no refresh, no spinner. Only a signal arrives; the page reloads through the
 * normal API, so the visitor still gets their own country's price.
 *
 * The connection opens the first time a page subscribes, and stays open for the visit.
 */
@Injectable({ providedIn: 'root' })
export class CatalogLiveService {
  private zone = inject(NgZone);
  private connection?: signalR.HubConnection;
  private raw = new Subject<CatalogChange>();

  /**
   * A burst of saves (a product and its prices, an order and its stock) arrives as one change.
   * Each visitor waits a slightly different time, so thousands of open pages do not all hit the
   * server in the same second.
   */
  private readonly settle = 600 + Math.floor(Math.random() * 1400);

  private readonly changes$: Observable<CatalogChange> = this.raw.pipe(
    buffer(this.raw.pipe(debounceTime(this.settle))),
    filter(batch => batch.length > 0),
    map(batch => ({
      productIds: batch.some(c => c.productIds === null)
        ? null
        : [...new Set(batch.flatMap(c => c.productIds ?? []))]
    })),
    share()
  );

  /** Every change, for a page that lists products. */
  changes(): Observable<CatalogChange> {
    this.connect();
    return this.changes$;
  }

  /**
   * Runs `load` after every change and emits its result. A failed load is skipped: the page keeps
   * what it shows and still hears the next change. A newer change cancels a load still running.
   */
  reload<T>(load: () => Observable<T>): Observable<T> {
    return this.changes().pipe(switchMap(() => load().pipe(catchError(() => EMPTY))));
  }

  /** Only the changes that can touch this product, for its own page. */
  changesFor(productId: () => string | undefined): Observable<CatalogChange> {
    return this.changes().pipe(
      filter(c => {
        const id = productId()?.toLowerCase();
        return !id || c.productIds === null || c.productIds.some(p => p.toLowerCase() === id);
      })
    );
  }

  private connect(): void {
    if (this.connection || typeof window === 'undefined') return;

    const hubPath = (environment.apiUrl ? environment.apiUrl.replace(/\/api\/?$/, '') : '') || '';
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubPath}/catalogHub`)
      // Keeps retrying for the whole visit: 0, 2, 10, 30 s, then every 30 s.
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ctx => [0, 2000, 10000][ctx.previousRetryCount] ?? 30000
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('CatalogChanged', (message: { productIds?: string[] | null }) => {
      this.zone.run(() => this.raw.next({ productIds: message?.productIds ?? null }));
    });

    // Changes made while the connection was down were never heard: reload everything once.
    this.connection.onreconnected(() => this.zone.run(() => this.raw.next({ productIds: null })));

    this.start();
  }

  /** The first start is not covered by automatic reconnect; retry it the same way. */
  private start(attempt = 0): void {
    this.connection?.start().catch(() => {
      const delay = [2000, 10000][attempt] ?? 30000;
      setTimeout(() => this.start(attempt + 1), delay);
    });
  }
}
