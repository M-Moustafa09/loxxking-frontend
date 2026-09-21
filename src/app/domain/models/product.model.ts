export * from './category.model';

export interface SizeChartRow {
  size: string;
  waistCm: string;
  hipsCm: string;
  waistIn: string;
  hipsIn: string;
}

export interface Product {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: string;
  sizes: string[];
  sizeChart: SizeChartRow[];
  stock: number;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  isBestSeller?: boolean;
  badge?: string;
  colors?: string[];
  guid?: string;
  aliases?: string[];
  /** Optional product video, shown on the product page after the images. */
  videoUrl?: string | null;
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  approved: boolean;
}
