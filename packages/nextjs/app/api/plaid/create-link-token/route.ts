import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "~~/services/plaid/plaidClient";

export async function POST(req: Request) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: walletAddress },
      client_name: "ZK-Pay",
      products: [Products.Transfer],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return NextResponse.json({ linkToken: response.data.link_token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
