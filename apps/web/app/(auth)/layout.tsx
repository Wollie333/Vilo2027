export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-route shells: /login renders its own full-bleed two-column; the rest
  // wrap themselves in AuthShell for the centered-card chrome.
  return children;
}
