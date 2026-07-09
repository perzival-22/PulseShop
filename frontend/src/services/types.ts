import type { AuthUser, Merchant, OrderDraft, PaymentResult, Product } from "@/types";

export interface Credentials {
  email: string;
  password: string;
}

export interface SignupInput {
  shopName: string;
  shopSlug: string;
  email: string;
  password: string;
  city: string;
  socials: { whatsapp: string; instagram: string; facebook: string };
}

/**
 * Merchant auth. The mock accepts anything and fabricates a session; the real
 * adapter (services/api/auth) wires these to Supabase Auth with the same shape.
 */
export interface AuthService {
  login(creds: Credentials): Promise<AuthUser>;
  signup(input: SignupInput): Promise<AuthUser>;
  logout(): Promise<void>;
}

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
  auth: AuthService;
  products: ProductService;
  orders: OrderService;
  payments: PaymentService;
}
