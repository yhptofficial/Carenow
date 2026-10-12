import type { Metadata } from "next";
import { DoctorProfile } from "./DoctorProfile";

export const metadata: Metadata = {
  title: "Doctor profile",
};

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DoctorProfile doctorId={id} />;
}
