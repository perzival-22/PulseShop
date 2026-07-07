import type { Merchant, OrderDraft, PaymentResult, Product } from "@/types";

export interface ProductInput {
  name: string;
  sku: string;
  category: string;
  priceKes: number;
  discountPct: number | null;
  stockQty: number;
  images: string[];
  sizes: string[] | null;
  description: string;
}

export interface ProductService {
  getMerchant(): Promise<Merchant>;
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
}

export interface OrderService {
  submitOrder(draft: OrderDraft): Promise<{ reference: string }>;
}

export interface PaymentService {
  payWithMpesa(phone: string, amount: number): Promise<PaymentResult>;
  payWithPaypal(amount: number): Promise<PaymentResult>;
}

export interface Services {
  products: ProductService;
  orders: OrderService;
  payments: PaymentService;
}
