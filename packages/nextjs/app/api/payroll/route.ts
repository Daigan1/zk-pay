import { NextResponse } from "next/server";

/**
 * Mock payroll API endpoint — simulates an employer's payroll data source.
 * In production, this would be a real payroll provider (ADP, Gusto, etc.)
 * that vlayer web proofs can verify via zkTLS.
 */
export async function GET() {
  const now = Math.floor(Date.now() / 1000);
  const nextPayDate = now + 14 * 24 * 60 * 60; // 14 days from now

  return NextResponse.json({
    salary: 5_000_000_000, // $5,000 in 6-decimal USDC format
    periodDays: 14,
    nextPayDate,
    employeeId: "EMP-001",
    employer: "Demo Corp",
    currency: "USD",
    verified: true,
  });
}
