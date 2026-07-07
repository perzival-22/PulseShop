import type { Merchant, OrderDraft, PaymentResult, Product } from "@/types";
import type { ProductInput, Services } from "../types";
import { statusForQty } from "@/lib/constants";
import { MERCHANT, PRODUCTS } from "./data";

const LATENCY = 300;
const STORAGE_KEY = "pulseshop-mock-products";

const delay = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));

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
  products: {
    async getMerchant(): Promise<Merchant> {
      await delay();
      return { ...MERCHANT, stats: { ...MERCHANT.stats, products: products.length } };
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
