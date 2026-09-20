import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CrmMenuEntry {
  key: string;
  label: string;
  /** Absolute CRM address — opening it leaves the store. Absent on a section that only opens a submenu. */
  url?: string;
  iconHtml: SafeHtml;
  children: CrmMenuEntry[];
}

interface CrmMenuApiItem {
  key?: string;
  label?: string;
  url?: string;
  icon?: string;
  children?: CrmMenuApiItem[];
}

/**
 * The admin who reaches this dashboard from Luxira's «Loxxking System» menu works in the CRM all
 * day; the store's own two-entry menu strands them. So the dashboard shows the CRM's sidebar, and
 * the store's backend is what fetches it (server to server, with the key the order sync uses) —
 * the browser never calls luxira.org, so no CORS and no cross-site cookie.
 *
 * Loaded once per page load and kept here: the menu is the same for every admin and does not
 * change while someone is working.
 */
@Injectable({ providedIn: 'root' })
export class CrmMenuService {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  readonly entries = signal<CrmMenuEntry[]>([]);

  private loaded = false;

  async load(): Promise<CrmMenuEntry[]> {
    if (this.loaded) return this.entries();
    this.loaded = true;

    try {
      const url = `${environment.apiBaseUrl || '/api'}/crm-menu`;
      const res = await firstValueFrom(this.http.get<any>(url, { withCredentials: true }));

      const baseUrl = (res?.baseUrl ?? '').replace(/\/$/, '');
      const sections: CrmMenuApiItem[] = Array.isArray(res?.sections) ? res.sections : [];

      this.entries.set(sections.map(section => this.toEntry(section, baseUrl)));
    } catch {
      // The CRM menu is a convenience, never a reason for the dashboard to fail. The store's own
      // entries stay, and the next page load tries again.
      this.loaded = false;
    }

    return this.entries();
  }

  private toEntry(item: CrmMenuApiItem, baseUrl: string): CrmMenuEntry {
    return {
      key: item.key ?? '',
      label: item.label ?? '',
      url: item.url ? `${baseUrl}${item.url}` : undefined,
      // The markup is the CRM's own inline icon, delivered over the server-to-server channel and
      // never touched by a store visitor, so the store renders it as-is to look identical.
      iconHtml: this.sanitizer.bypassSecurityTrustHtml(item.icon ?? ''),
      children: (item.children ?? []).map(child => this.toEntry(child, baseUrl))
    };
  }
}
