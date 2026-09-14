import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getMetamaskConfig = createServerFn({ method: "GET" }).handler(async () => ({
  walletAddress: process.env["MERCHANT_WALLET_ADDRESS"] || "",
  chainId: "",
  rpcUrl: "",
}));
export const createMetamaskOrder = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.unknown().parse(value))
  .handler(async () => {
    throw new Error("Use PayRam checkout. A wallet connection alone cannot confirm payment.");
  });
