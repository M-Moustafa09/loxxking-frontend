import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { catchError, of, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { isReturningVisitor } from '../../utils/visitor-status.util';

export interface AppContext {
  country: string;
  countryId?: string;
  currency: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContextService {
  private readonly CURRENCY_STORAGE_KEY = `${environment.storagePrefix}currency`;
  
  public currentCurrency = signal<string>('USD');
  public currentCountry = signal<string>('Unknown');
  public currentCountryId = signal<string | null>(null);
  private visitLogged = false;

  constructor(private http: HttpClient, private translate: TranslateService) {}

  initContext(): void {
    const explicitCurrency = localStorage.getItem(this.CURRENCY_STORAGE_KEY);
    
    // Resolve context
    this.http.get<AppContext>(`${environment.apiUrl}/v1/context/init`)
      .pipe(
        catchError(() => of<AppContext>({ country: 'Unknown', currency: 'USD', countryId: undefined }))
      )
      .subscribe((context: AppContext) => {
        this.currentCountry.set(context.country);
        if (context.countryId) {
          this.currentCountryId.set(context.countryId);
        }
        
        // Priority: Explicit LocalStorage > Detected Context > USD
        if (explicitCurrency) {
          this.setCurrency(explicitCurrency);
        } else {
          this.setCurrency(context.currency || 'USD');
        }
      });
  }

  /**
   * One visit per page load (not per in-app navigation). The backend also forwards it to the
   * Luxira CRM, which pops up a notification and emails the owner for every visit — so the
   * dashboard, and the storefront preview the dashboard shows in an iframe, are not visits.
   */
  logVisit(page: string, language: string): void {
    if (this.visitLogged) return;
    if (typeof window !== 'undefined') {
      const inIframe = window.parent !== window;
      if (inIframe || page.startsWith('/admin')) return;
    }
    this.visitLogged = true;

    // Arabic slugs arrive percent-encoded; decode so the CRM and the email show readable text.
    try {
      page = decodeURIComponent(page);
    } catch {
      // Malformed escape: keep the raw path.
    }

    // If countryId is known, pass it, otherwise backend resolves from IP or defaults.
    this.http.post(`${environment.apiUrl}/site-visits`, {
      page: page.slice(0, 300),
      countryId: this.currentCountryId(),
      language,
      isNewVisitor: !isReturningVisitor()
    })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  setExplicitCurrency(currency: string): void {
    localStorage.setItem(this.CURRENCY_STORAGE_KEY, currency);
    this.setCurrency(currency);
  }

  private resolveCurrencySymbol(currency: string, locale: string): string {
    const commonArabicMap: Record<string, string> = {
      SAR: 'ر.س',
      EGP: 'ج.م',
      AED: 'د.إ',
      KWD: 'د.ك',
      QAR: 'ر.ق',
      BHD: 'د.ب',
      OMR: 'ر.ع',
      JOD: 'د.ا',
      MAD: 'د.م',
      LYD: 'د.ل',
      DZD: 'د.ج',
      TND: 'د.ت',
      IQD: 'د.ع',
      SYP: 'ل.س',
      LBP: 'ل.ل',
      TRY: '₺',
      USD: '$',
      EUR: '€',
      GBP: '£'
    };

    if (locale.startsWith('ar') && commonArabicMap[currency]) {
      return commonArabicMap[currency];
    }

    try {
      const parts = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        currencyDisplay: 'narrowSymbol'
      }).formatToParts(1);
      const symbol = parts.find(p => p.type === 'currency')?.value;
      if (symbol) return symbol;
    } catch {
      try {
        const parts = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency,
          currencyDisplay: 'symbol'
        }).formatToParts(1);
        const symbol = parts.find(p => p.type === 'currency')?.value;
        if (symbol) return symbol;
      } catch {}
    }

    return currency;
  }

  private setCurrency(currency: string): void {
    this.currentCurrency.set(currency);
    
    const arCurrency = this.resolveCurrencySymbol(currency, 'ar');
    const enCurrency = this.resolveCurrencySymbol(currency, 'en');

    this.translate.setTranslation('ar', { COMMON: { CURRENCY: arCurrency } }, true);
    this.translate.setTranslation('en', { COMMON: { CURRENCY: enCurrency } }, true);
  }
}
