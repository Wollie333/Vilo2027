import type { Metadata } from "next";

import { BusinessForm, EMPTY_BUSINESS } from "../_components/BusinessForm";

export const metadata: Metadata = {
  title: "Add a business · Settings",
};

export default function NewBusinessPage() {
  return <BusinessForm mode="create" initial={EMPTY_BUSINESS} />;
}
