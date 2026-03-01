import { NextResponse } from "next/server";
import { plaidClient } from "~~/services/plaid/plaidClient";

export async function POST(req: Request) {
  try {
    const { transferId } = await req.json();
    if (!transferId) {
      return NextResponse.json({ error: "transferId required" }, { status: 400 });
    }

    const response = await plaidClient.transferGet({
      transfer_id: transferId,
    });

    return NextResponse.json({
      status: response.data.transfer.status,
      amount: response.data.transfer.amount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check transfer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
