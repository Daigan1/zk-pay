import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
      "PLAID-SECRET": process.env.PLAID_SECRET || "",
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// In-memory store for hackathon demo (resets on server restart)
type PlaidStore = {
  accessToken: string;
  itemId: string;
  bankName?: string;
};

const plaidStore = new Map<string, PlaidStore>();

export function storePlaidAccess(walletAddress: string, data: PlaidStore) {
  plaidStore.set(walletAddress.toLowerCase(), data);
}

export function getPlaidAccess(walletAddress: string): PlaidStore | undefined {
  return plaidStore.get(walletAddress.toLowerCase());
}

export function hasPlaidAccess(walletAddress: string): boolean {
  return plaidStore.has(walletAddress.toLowerCase());
}
