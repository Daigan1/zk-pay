import { LendDashboard } from "./_components/LendDashboard";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Lend",
  description: "Deposit USDC to earn fixed fees from wage-backed lending",
});

const LendPage: NextPage = () => {
  return <LendDashboard />;
};

export default LendPage;
