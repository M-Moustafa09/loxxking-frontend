import { Injectable, signal, computed, PLATFORM_ID, Inject, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../../environments/environment';

const GUEST_ID_KEY = 'lk-guest-id';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private http = inject(HttpClient);
  private favoriteIdsSignal = signal<string[]>([]);
  public favoriteProductIds = this.favoriteIdsSignal.asReadonly();
  private guestId = '';

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.guestId = localStorage.getItem(GUEST_ID_KEY) || crypto.randomUUID();
      localStorage.setItem(GUEST_ID_KEY, this.guestId);
      this.fetchFavorites();
    }
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'X-Guest-Id': this.guestId });
  }

  fetchFavorites() {
    this.http.get<any>(`${environment.apiBaseUrl}/favorites`, { headers: this.getHeaders() }).subscribe({
      next: (res: any) => {
        const ids = (res?.data || res || []).map((f: any) => f.productId || f.id);
        this.favoriteIdsSignal.set(ids);
      },
      error: (err: any) => console.error(err)
    });
  }

  toggleFavorite(productId: string) {
    const current = this.favoriteIdsSignal();
    const exists = current.includes(productId);
    
    // Newest first, as the server lists them.
    this.favoriteIdsSignal.set(exists ? current.filter(id => id !== productId) : [productId, ...current]);

    if (exists) {
      this.http.delete<any>(`${environment.apiBaseUrl}/favorites/${productId}`, { headers: this.getHeaders() }).subscribe({
        error: (err: any) => this.fetchFavorites()
      });
    } else {
      this.http.post<any>(`${environment.apiBaseUrl}/favorites/${productId}`, {}, { headers: this.getHeaders() }).subscribe({
        error: (err: any) => this.fetchFavorites()
      });
    }
  }

  removeFavorite(productId: string) {
    if (this.isFavorite(productId)) {
      this.toggleFavorite(productId);
    }
  }

  clearFavorites() {
    this.favoriteIdsSignal.set([]);
    this.fetchFavorites();
  }

  isFavorite(productId: string): boolean {
    return this.favoriteProductIds().includes(productId);
  }
}
