import { NextResponse } from "next/server";
import { ACHClass, TransferNetwork, TransferType } from "plaid";
import { getPlaidAccess, plaidClient } from "~~/services/plaid/plaidClient";

/**
 * Auto-settle: Triggered when an employee connects their bank via Plaid.
 * 1. Looks up the employee's loan repayment amount (passed from frontend).
 * 2. Initiates a Plaid ACH debit for that amount.
 * 3. In sandbox mode, simulates instant settlement.
 * 4. Returns success so the frontend can trigger on-chain settlePayment.
 */
async function getAnyAccountId(accessToken: string): Promise<string> {
  const res = await plaidClient.accountsGet({ access_token: accessToken });
  const accounts = res.data.accounts ?? [];

  const picked =
    accounts.find(a => a.subtype === "checking") ?? accounts.find(a => a.subtype === "savings") ?? accounts[0];

  if (!picked?.account_id) throw new Error("No accounts found for access_token");
  return picked.account_id;
}

export async function POST(req: Request) {
  try {
    const { walletAddress, repaymentAmount } = await req.json();

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    // IMPORTANT: await in case storage lookup is async
    const plaidData = await getPlaidAccess(walletAddress);

    // If no stored bank data (e.g. dev server hot-reloaded), still return
    // success so the frontend can proceed with on-chain settlement.
    if (!plaidData?.accessToken) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "ACH skipped (bank session expired) — proceeding with on-chain settle",
      });
    }

    // Default repayment amount for demo ($1,515 = $1,500 principal + $15 fee at 1%)
    const amount = String(repaymentAmount ?? "1515.00");

    // ✅ Always use a real account_id (derive it from Plaid if you didn't store it)
    const accountId = await getAnyAccountId(plaidData.accessToken);

    // Authorize the ACH debit
    const authResponse = await plaidClient.transferAuthorizationCreate({
      access_token: plaidData.accessToken,
      account_id: accountId,
      type: TransferType.Debit,
      network: TransferNetwork.Ach,
      amount,
      ach_class: ACHClass.Ppd,
      user: {
        legal_name: "Demo User",
      },
    });

    const authorizationId = authResponse.data.authorization.id;

    // Create the transfer
    const transferResponse = await plaidClient.transferCreate({
      access_token: plaidData.accessToken,
      account_id: accountId,
      authorization_id: authorizationId,
      description: "ZK-Pay wage credit repayment",
    });

    const transferId = transferResponse.data.transfer.id;

    // In sandbox mode, simulate the transfer completing instantly
    try {
      await plaidClient.sandboxTransferSimulate({
        transfer_id: transferId,
        event_type: "posted",
      });
    } catch {
      // Not in sandbox mode — transfer will settle via normal ACH timeline
    }

    return NextResponse.json({
      success: true,
      transferId,
      amount,
      accountIdUsed: accountId,
    });
  } catch (error: any) {
    // Surface Plaid error details instead of just a generic message
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
