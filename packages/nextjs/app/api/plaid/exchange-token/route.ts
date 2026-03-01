import { NextResponse } from "next/server";
import { plaidClient, storePlaidAccess } from "~~/services/plaid/plaidClient";

export async function POST(req: Request) {
  try {
    const { publicToken, walletAddress, bankName } = await req.json();
    if (!publicToken || !walletAddress) {
      return NextResponse.json({ error: "publicToken and walletAddress required" }, { status: 400 });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    storePlaidAccess(walletAddress, {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
      bankName,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to exchange token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
