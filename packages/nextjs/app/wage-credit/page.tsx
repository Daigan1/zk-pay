import { WageCredit } from "./_components/WageCredit";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Wage Credit",
  description: "Unlock early wage access backed by your verified payroll",
});

const WageCreditPage: NextPage = () => {
  return <WageCredit />;
};

export default WageCreditPage;
