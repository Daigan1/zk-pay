import { AdminDashboard } from "./_components/AdminDashboard";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Admin",
  description: "Manage payroll, treasury, and loan settlements",
});

const AdminPage: NextPage = () => {
  return <AdminDashboard />;
};

export default AdminPage;
