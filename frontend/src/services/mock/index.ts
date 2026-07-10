import type { AuthUser, Merchant, OrderDraft, PaymentResult, Product } from "@/types";
import type { Credentials, MerchantUpdate, ProductInput, Services, SignupInput } from "../types";
import { statusForQty } from "@/lib/constants";
import { MERCHANT, PRODUCTS } from "./data";

const LATENCY = 300;
const STORAGE_KEY = "pulseshop-mock-products";
const MERCHANT_KEY = "pulseshop-mock-merchant";

const delay = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));

function loadMerchant(): Merchant {
  try {
    const raw = localStorage.getItem(MERCHANT_KEY);
    if (raw) return { ...structuredClone(MERCHANT), ...JSON.parse(raw) } as Merchant;
  } catch {
    /* fall through to seed */
  }
  return structuredClone(MERCHANT);
}

function saveMerchant(m: Merchant) {
  try {
    localStorage.setItem(MERCHANT_KEY, JSON.stringify(m));
  } catch {
    /* storage full/unavailable — keep in-memory copy */
  }
}

let merchant = loadMerchant();

function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Product[];
  } catch {
    /* fall through to seed */
  }
  return structuredClone(PRODUCTS);
}

function saveProducts(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch {
    /* storage full/unavailable — keep in-memory copy */
  }
}

let products = loadProducts();

const makeRef = () =>
  `PS-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;

export const mockServices: Services = {
  auth: {
    // Accepts any credentials and returns the demo shop's session.
    async login({ email }: Credentials): Promise<AuthUser> {
      await delay();
      return { id: "u1", email, shopName: MERCHANT.name, shopSlug: MERCHANT.handle };
    },

    async signup(input: SignupInput): Promise<AuthUser> {
      await delay();
      return {
        id: `u${Date.now()}`,
        email: input.email,
        shopName: input.shopName,
        shopSlug: input.shopSlug,
      };
    },

    async logout(): Promise<void> {
      await delay();
    },

    async updateEmail(_email: string): Promise<void> {
      await delay();
    },
  },

  products: {
    async getMerchant(): Promise<Merchant> {
      await delay();
      return { ...structuredClone(merchant), stats: { ...merchant.stats, products: products.length } };
    },

    async updateMerchant(patch: MerchantUpdate): Promise<Merchant> {
      await delay();
      const { whatsapp, instagram, facebook, ...rest } = patch;
      merchant = {
        ...merchant,
        ...rest,
        contacts: {
          whatsapp: whatsapp ?? merchant.contacts.whatsapp,
          instagram: instagram ?? merchant.contacts.instagram,
          facebook: facebook ?? merchant.contacts.facebook,
        },
      };
      saveMerchant(merchant);
      return { ...structuredClone(merchant), stats: { ...merchant.stats, products: products.length } };
    },

    async listProducts(): Promise<Product[]> {
      await delay();
      return structuredClone(products);
    },

    async getProduct(id: string): Promise<Product | null> {
      await delay();
      const found = products.find((p) => p.id === id);
      return found ? structuredClone(found) : null;
    },

    async createProduct(input: ProductInput): Promise<Product> {
      await delay();
      const product: Product = {
        ...input,
        id: `p${Date.now()}`,
        status: statusForQty(input.stockQty),
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      };
      products = [product, ...products];
      saveProducts(products);
      return structuredClone(product);
    },

    async updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
      await delay();
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error(`Product ${id} not found`);
      const next = { ...products[idx], ...patch };
      next.status = statusForQty(next.stockQty);
      products[idx] = next;
      saveProducts(products);
      return structuredClone(next);
    },

    async deleteProduct(id: string): Promise<void> {
      await delay();
      products = products.filter((p) => p.id !== id);
      saveProducts(products);
    },
  },

  orders: {
    async submitOrder(_draft: OrderDraft): Promise<{ reference: string }> {
      await delay();
      return { reference: makeRef() };
    },
  },

  payments: {
    // Simulates an M-Pesa STK push: pending ~3s, then resolves.
    async payWithMpesa(_phone: string, _amount: number): Promise<PaymentResult> {
      await delay(3000);
      return { status: "paid", reference: makeRef() };
    },

    async payWithPaypal(_amount: number): Promise<PaymentResult> {
      await delay(1200);
      return { status: "paid", reference: makeRef() };
    },
  },
};
