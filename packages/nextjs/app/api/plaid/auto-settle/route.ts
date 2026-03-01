import { NextResponse } from "next/server";
import { ACHClass, TransferNetwork, TransferType } from "plaid";
import { getPlaidAccess, plaidClient } from "~~/services/plaid/plaidClient";

async function getAnyAccountId(accessToken: string): Promise<string> {
  const res = await plaidClient.accountsGet({ access_token: accessToken });
  const accounts = res.data.accounts ?? [];

  const picked =
    accounts.find(a => a.subtype === "checking") ?? accounts.find(a => a.subtype === "savings") ?? accounts[0];

  if (!picked?.account_id) throw new Error("No accounts found for access_token");
  return picked.account_id;
}

function isAuthNotApprovedError(err: any) {
  const msg = err?.response?.data?.error_message ?? err?.message ?? "";
  return typeof msg === "string" && msg.toLowerCase().includes("authorization was not approved");
}

export async function POST(req: Request) {
  try {
    const { walletAddress, repaymentAmount } = await req.json();

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    const plaidData = await getPlaidAccess(walletAddress);

    // If no stored bank data, still succeed for demo flow.
    if (!plaidData?.accessToken) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "ACH skipped (bank session missing) — proceeding with on-chain settle",
      });
    }

    // Sandbox-friendly small amount to reduce declines.
    const amount = String(repaymentAmount ?? "1.00");

    const accountId = await getAnyAccountId(plaidData.accessToken);

    // 1) Authorization
    const authResponse = await plaidClient.transferAuthorizationCreate({
      access_token: plaidData.accessToken,
      account_id: accountId,
      type: TransferType.Debit,
      network: TransferNetwork.Ach,
      amount,
      ach_class: ACHClass.Ppd,
      user: { legal_name: "Demo User" },
    });

    const auth = authResponse.data.authorization;

    // IMPORTANT: normalize decision string
    const decision = String(auth.decision ?? "").toLowerCase();

    // If not approved, NEVER fail the demo.
    if (decision !== "approved") {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "authorization_not_approved",
        decision: auth.decision,
        rationale: null,
        amount,
        message: "Plaid authorization declined in sandbox — proceeding with on-chain settle",
      });
    }

    // 2) Create transfer (description must be <= 15 chars)
    let transferId: string;
    try {
      const transferResponse = await plaidClient.transferCreate({
        access_token: plaidData.accessToken,
        account_id: accountId,
        authorization_id: auth.id,
        description: "ZK-Pay repay", // <= 15 chars
      });
      transferId = transferResponse.data.transfer.id;
    } catch (err: any) {
      // If Plaid still says "authorization was not approved", don't 500 — just skip.
      if (isAuthNotApprovedError(err)) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "authorization_not_approved_at_create",
          amount,
          message: "Plaid rejected transferCreate in sandbox — proceeding with on-chain settle",
          details: err?.response?.data ?? null,
        });
      }
      throw err;
    }

    // 3) Sandbox simulate posted
    try {
      await plaidClient.sandboxTransferSimulate({
        transfer_id: transferId,
        event_type: "posted",
      });
    } catch {
      // ignore if not sandbox
    }

    return NextResponse.json({
      success: true,
      transferId,
      amount,
      accountIdUsed: accountId,
    });
  } catch (error: any) {
    const plaid = error?.response?.data;
    console.error("Auto-settle failed:", {
      message: error?.message,
      status: error?.response?.status,
      plaid,
    });

    return NextResponse.json(
      { error: "Auto-settle failed", details: plaid ?? error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
