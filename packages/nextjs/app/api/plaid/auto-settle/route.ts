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
export async function POST(req: Request) {
  try {
    const { walletAddress, repaymentAmount } = await req.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    const plaidData = getPlaidAccess(walletAddress);

    // If no stored bank data (e.g. dev server hot-reloaded), still return
    // success so the frontend can proceed with on-chain settlement.
    if (!plaidData) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "ACH skipped (bank session expired) — proceeding with on-chain settle",
      });
    }

    // Default repayment amount for demo ($1,515 = $1,500 principal + $15 fee at 1%)
    const amount = repaymentAmount || "1515.00";

    // Authorize the ACH debit
    const authResponse = await plaidClient.transferAuthorizationCreate({
      access_token: plaidData.accessToken,
      account_id: "",
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
      account_id: "",
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Auto-settle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
