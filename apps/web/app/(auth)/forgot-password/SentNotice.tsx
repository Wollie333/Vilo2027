import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SentNotice() {
  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader className="space-y-2 pb-4 text-center">
        <CardTitle className="font-display text-2xl font-bold tracking-tight text-brand-ink">
          Check your inbox
        </CardTitle>
        <CardDescription className="text-brand-mute">
          If an account exists for that email, a reset link is on its way.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded border border-brand-line bg-brand-accent/60 px-4 py-3 text-sm text-brand-ink">
          The link expires in 1 hour. If you don&rsquo;t see the email, check
          your spam folder.
        </div>

        <p className="text-center text-sm text-brand-mute">
          <Link
            href="/login"
            className="font-medium text-brand-primary hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
