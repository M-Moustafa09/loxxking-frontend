import { Observable } from 'rxjs';
import { Product, Category, Review } from '../models/product.model';

export interface IProductRepository {
  getProducts(silent?: boolean): Observable<Product[]>;
  getProductById(id: string, silent?: boolean): Observable<Product | undefined>;
  getProductBySlug(slug: string, silent?: boolean): Observable<Product | undefined>;
  getCategories(): Observable<Category[]>;
  getCategoryBySlug(slug: string): Observable<Category | undefined>;
  getReviews(productId?: string): Observable<Review[]>;
  getRealProductId(mockId: string): string | null;
}
