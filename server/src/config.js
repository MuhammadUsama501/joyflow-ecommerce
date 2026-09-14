import { isAddress, getAddress, ZeroAddress } from "ethers";
import { assert } from "./utils/errors.js";
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 5000),
    clientUrl: env.CLIENT_URL || "http://localhost:5173",
    apiUrl: env.PAYRAM_API_URL || "",
    apiKey: env.PAYRAM_API_KEY || "",
    webhookSecret: env.PAYRAM_WEBHOOK_SECRET || env.PAYRAM_API_KEY || "",
    wallet: env.MERCHANT_WALLET_ADDRESS || "",
    asset: env.CRYPTO_ASSET || "USDT",
    network: env.CRYPTO_NETWORK || "",
    cardEnabled: env.PAYRAM_CARD_ENABLED === "true",
    walletConfigured: env.PAYRAM_WALLET_CONFIGURED === "true",
    production: env.NODE_ENV === "production",
  };
}
export function validatePaymentConfig(config) {
  assert(config.apiUrl && config.apiKey, 503, "PayRam checkout is not configured yet.");
  let url;
  try {
    url = new URL(config.apiUrl);
  } catch {
    assert(false, 503, "PayRam URL is invalid.");
  }
  assert(
    !url.username && !url.password && !url.search && !url.hash && url.pathname === "/",
    503,
    "Use the PayRam origin URL without a path or credentials.",
  );
  const local = !config.production && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  assert(
    url.protocol === "https:" || (url.protocol === "http:" && local),
    503,
    "PayRam requires HTTPS outside local development.",
  );
  assert(
    ["ETH", "BASE", "POL"].includes(config.network),
    503,
    "Configure a supported EVM PayRam network: ETH, BASE or POL.",
  );
  assert(
    ["USDT", "USDC"].includes(config.asset),
    503,
    "Configure USDT or USDC and confirm network support in PayRam.",
  );
  assert(
    isAddress(config.wallet) && getAddress(config.wallet) !== ZeroAddress,
    503,
    "Configure a valid merchant public EVM wallet address.",
  );
  assert(
    config.webhookSecret === config.apiKey,
    503,
    "PayRam webhook signing uses the project API key.",
  );
  assert(
    config.walletConfigured,
    503,
    "Confirm the wallet, asset and network in PayRam before enabling checkout.",
  );
}
