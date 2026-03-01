import { NextResponse } from "next/server";
import { ACHClass, TransferNetwork, TransferType } from "plaid";
import { getPlaidAccess, plaidClient } from "~~/services/plaid/plaidClient";

export async function POST(req: Request) {
  try {
    const { employee, amount, description } = await req.json();
    if (!employee) {
      return NextResponse.json({ error: "employee address required" }, { status: 400 });
    }

    const plaidData = getPlaidAccess(employee);
    if (!plaidData) {
      return NextResponse.json({ error: "Employee has not linked a bank account" }, { status: 400 });
    }

    const transferAmount = amount || "100.00";

    // Step 1: Authorize the transfer
    const authResponse = await plaidClient.transferAuthorizationCreate({
      access_token: plaidData.accessToken,
      account_id: "",
      type: TransferType.Debit,
      network: TransferNetwork.Ach,
      amount: transferAmount,
      ach_class: ACHClass.Ppd,
      user: {
        legal_name: "Demo User",
      },
    });

    const authorizationId = authResponse.data.authorization.id;

    // Step 2: Create the transfer using the authorization
    const response = await plaidClient.transferCreate({
      access_token: plaidData.accessToken,
      account_id: "",
      authorization_id: authorizationId,
      description: description || "ZK-Pay wage repayment",
    });

    return NextResponse.json({
      transferId: response.data.transfer.id,
      status: response.data.transfer.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
