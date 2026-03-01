import { NextResponse } from "next/server";

/**
 * AI Agent endpoint that uses x402 protocol to pay for trading strategy advice.
 *
 * Flow:
 * 1. Frontend calls this endpoint with current allocation
 * 2. Agent pays the x402-protected strategy API for a recommendation
 * 3. Returns the recommendation to the frontend
 *
 * For the hackathon demo, we simulate the x402 payment flow and call our
 * internal recommendation endpoint directly.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { currentAllocation } = body;

    // Step 1: Simulate x402 payment for strategy advice
    // In production: use @x402/fetch to make a paid HTTP request
    // const paidResponse = await x402Fetch("https://strategy-api.example.com/recommend", {
    //   method: "POST",
    //   body: JSON.stringify({ allocation: currentAllocation }),
    //   paymentSigner: x402Signer,
    // });

    const paymentAmount = "0.01"; // USDC cost per recommendation

    // Step 2: Call our strategy recommendation endpoint
    const origin = req.headers.get("origin") || req.headers.get("host") || "localhost:3000";
    const protocol = origin.startsWith("localhost") ? "http" : "https";
    const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;

    const strategyResponse = await fetch(`${baseUrl}/api/strategy/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentAllocation }),
    });

    if (!strategyResponse.ok) {
      throw new Error("Strategy API request failed");
    }

    const recommendation = await strategyResponse.json();

    // Step 3: Return recommendation with x402 payment metadata
    return NextResponse.json({
      ...recommendation,
      x402: {
        paid: true,
        amount: paymentAmount,
        currency: "USDC",
        protocol: "x402",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI agent failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
