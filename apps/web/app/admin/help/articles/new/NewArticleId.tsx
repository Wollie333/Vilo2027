"use client";

import { useState } from "react";

export function NewArticleId({
  children,
}: {
  children: (id: string) => React.ReactNode;
}) {
  const [id] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000",
  );
  return <>{children(id)}</>;
}
