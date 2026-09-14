export type PaypalCreds = {
  clientId: string;
  clientSecret: string;
  env: "sandbox" | "live";
};

export type MetamaskCreds = {
  walletAddress: string;
  chainId: string;
  rpcUrl: string;
};

export type OrderItem = {
  slug: string;
  name: string;
  qty: number;
  price_cents: number;
};

export type Order = {
  id: string;
  created_at: string;
  email: string;
  amount_cents: number;
  currency: string;
  status: string;
  license_key: string;
  items: OrderItem[];
};

const PAYPAL_KEY = "ledgerline.paypal-creds.v1";
const METAMASK_KEY = "ledgerline.metamask-creds.v1";
const ORDERS_KEY = "ledgerline.orders.v1";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function getPaypalCredentials(): PaypalCreds | null {
  return read<PaypalCreds>(PAYPAL_KEY);
}

export function savePaypalCredentials(creds: PaypalCreds): void {
  write(PAYPAL_KEY, creds);
}

export function clearPaypalCredentials(): void {
  try {
    localStorage.removeItem(PAYPAL_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getMetamaskCredentials(): MetamaskCreds | null {
  return read<MetamaskCreds>(METAMASK_KEY);
}

export function saveMetamaskCredentials(creds: MetamaskCreds): void {
  write(METAMASK_KEY, creds);
}

export function clearMetamaskCredentials(): void {
  try {
    localStorage.removeItem(METAMASK_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getOrders(): Order[] {
  const orders = read<Order[]>(ORDERS_KEY);
  return Array.isArray(orders) ? orders : [];
}

export function saveOrder(order: Order): void {
  const orders = getOrders();
  orders.unshift(order);
  write(ORDERS_KEY, orders);
}

export function resetOrders(): void {
  try {
    localStorage.removeItem(ORDERS_KEY);
  } catch {
    /* storage unavailable */
  }
}
