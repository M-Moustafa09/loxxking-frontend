import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';

/**
 * One row of `GET /api/products` as the dashboard uses it.
 *
 * `productCode`, `features`, `shippingPolicy` and `returnPolicy` matter even though the form does
 * not show all of them: `PUT /api/products/{id}` is a full replace, so a field the form omits is
 * wiped. They are read here and sent back untouched.
 */
export interface AdminProduct {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  description: string;
  price: number;
  images: string[];
  /** The category's English name — what the list column shows. */
  categoryName: string;
  categoryId: string;
  productCode: string | null;
  features: string | null;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  /** The one product video, or null. Uploaded and removed on its own endpoint, not by the form save. */
  videoUrl: string | null;
}

export interface AdminCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  image: string;
  /** Live products in the category; one that still holds products cannot be deleted. */
  productCount: number;
}

/**
 * A product from the CRM (Luxira's SubWarehouse list) with its code. The store product picks one of
 * these instead of typing the code; `linkedProductId` is the live store product already using it.
 */
export interface CrmProduct {
  id: number;
  name: string;
  productCode: string;
  group: string | null;
  linkedProductId: string | null;
}

/** What the category form owns. `image` is a URL, a new data URL, or '' for none. */
export interface CategoryFormValue {
  nameAr: string;
  nameEn: string;
  image: string;
}

/** What the add/edit form owns. Everything else on the product is preserved as-is. */
export interface ProductFormValue {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  description: string;
  images: string[];
  basePrice: number;
  productCode: string | null;
}

/** The API wraps every payload in `{ success, message, data }`. */
interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class AdminProductsService {
  private http = inject(HttpClient);

  private readonly productsSignal = signal<AdminProduct[]>([]);
  private readonly categoriesSignal = signal<AdminCategory[]>([]);

  readonly products = this.productsSignal.asReadonly();
  readonly categories = this.categoriesSignal.asReadonly();

  fetchProducts(): Observable<AdminProduct[]> {
    return this.http.get<ApiEnvelope<any[]>>(`${environment.apiBaseUrl}/products`).pipe(
      map(res => (res?.data ?? []).map(row => this.toProduct(row))),
      tap(products => this.productsSignal.set(products))
    );
  }

  fetchCategories(): Observable<AdminCategory[]> {
    return this.http.get<ApiEnvelope<any[]>>(`${environment.apiBaseUrl}/categories`).pipe(
      map(res => (res?.data ?? []).map(row => ({
        id: row.id,
        nameAr: row.nameAr ?? '',
        nameEn: row.nameEn ?? '',
        slug: row.slug ?? '',
        image: row.image ?? '',
        productCount: Number(row.productCount ?? 0)
      }))),
      tap(categories => this.categoriesSignal.set(categories))
    );
  }

  /** Errors when the CRM cannot be reached: an empty picker would read as "the CRM has no products". */
  fetchCrmProducts(): Observable<CrmProduct[]> {
    return this.http.get<ApiEnvelope<any[]>>(`${environment.apiBaseUrl}/crm-products`).pipe(
      map(res => (res?.data ?? []).map(row => ({
        id: Number(row.id),
        name: row.name ?? '',
        productCode: row.productCode ?? '',
        group: row.group ?? null,
        linkedProductId: row.linkedProductId ?? null
      })))
    );
  }

  createCategory(form: CategoryFormValue): Observable<unknown> {
    return this.http.post(`${environment.apiBaseUrl}/categories`, {
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      image: form.image
    });
  }

  updateCategory(id: string, form: CategoryFormValue): Observable<unknown> {
    return this.http.put(`${environment.apiBaseUrl}/categories/${id}`, {
      id,
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      image: form.image
    });
  }

  removeCategory(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiBaseUrl}/categories/${id}`);
  }

  create(form: ProductFormValue): Observable<unknown> {
    return this.http.post(`${environment.apiBaseUrl}/products`, {
      categoryId: form.categoryId,
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      description: form.description,
      images: form.images,
      features: null,
      shippingPolicy: null,
      returnPolicy: null,
      basePrice: form.basePrice,
      productCode: form.productCode
    });
  }

  /**
   * `existing` carries the fields the form does not edit. Dropping it would blank the product's
   * features and policies — and, worse, its Luxira code, which the CRM needs to find the warehouse
   * an order line ships from.
   */
  update(id: string, form: ProductFormValue, existing: AdminProduct): Observable<unknown> {
    return this.http.put(`${environment.apiBaseUrl}/products/${id}`, {
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      description: form.description,
      images: form.images,
      features: existing.features,
      shippingPolicy: existing.shippingPolicy,
      returnPolicy: existing.returnPolicy,
      basePrice: form.basePrice,
      productCode: form.productCode
    });
  }

  /** Replaces the product video. Emits upload progress events, so the form can show a percentage. */
  uploadVideo(id: string, file: File): Observable<HttpEvent<unknown>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post(`${environment.apiBaseUrl}/products/${id}/video`, body, {
      reportProgress: true,
      observe: 'events'
    });
  }

  removeVideo(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiBaseUrl}/products/${id}/video`);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiBaseUrl}/products/${id}`);
  }

  private toProduct(row: any): AdminProduct {
    return {
      id: row.id,
      slug: row.slug ?? '',
      nameAr: row.nameAr ?? '',
      nameEn: row.nameEn ?? '',
      description: row.descAr || row.descEn || '',
      price: Number(row.price ?? 0),
      images: Array.isArray(row.images) ? row.images : [],
      categoryName: row.category ?? '',
      categoryId: row.categoryId ?? '',
      productCode: row.productCode ?? null,
      features: row.features ?? null,
      shippingPolicy: row.shippingPolicy ?? null,
      returnPolicy: row.returnPolicy ?? null,
      videoUrl: row.videoUrl ?? null
    };
  }
}
