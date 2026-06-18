import { QueryClient } from "@tanstack/react-query";

// Single shared client. Phase 7 layers a persisted cache + offline outbox on top.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
