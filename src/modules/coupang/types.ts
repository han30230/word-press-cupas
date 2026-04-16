/**
 * 앱 내부에서 사용하는 정규화된 상품 정보
 */
export interface NormalizedProduct {
  /** 쿠팡 상품 ID(있을 때만). 골드박스 등 중복 발행 방지용 */
  productId: number | null;
  productName: string;
  productImage: string;
  productUrl: string;
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  isRocket: boolean;
  isFreeShipping: boolean;
  rank: number;
}

export interface CoupangSearchApiResponse {
  rCode: string;
  rMessage?: string;
  data?: {
    productData?: CoupangRawProduct[];
  };
}

/** 골드박스 API: data가 배열이거나 productData 래핑일 수 있음 */
export interface CoupangGoldboxApiResponse {
  rCode: string;
  rMessage?: string;
  data?: CoupangRawProduct[] | { productData?: CoupangRawProduct[] } | null;
}

/** 검색 API 원본(필드명은 문서/버전에 따라 다를 수 있음) */
export interface CoupangRawProduct {
  keyword?: string;
  rank?: number;
  isRocket?: boolean;
  isFreeShipping?: boolean;
  productId?: number | string;
  productName?: string;
  productImage?: string;
  /** 일부 응답 변형 */
  productImageUrl?: string;
  imageUrl?: string;
  thumbnailImage?: string;
  mainImage?: string;
  productUrl?: string;
  productPrice?: number;
  /** 일부 응답에서 문자열로 올 수 있음 */
  productPriceString?: string;
  rating?: number;
  reviewRating?: number;
  reviewRatingCount?: number;
  reviewCount?: number;
  ratingCount?: number;
  [key: string]: unknown;
}
