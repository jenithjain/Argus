import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-3">Forgot Password</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Password reset is not enabled yet for this deployment. Please sign in with Google,
          or contact an administrator to reset your credentials.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to Login
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
