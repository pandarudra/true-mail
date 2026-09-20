"use client";

import { use } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { AuthShell } from "@/components/AuthShell";
import { DrawablyLinkButton } from "@/components/ui/DrawablyLinkButton";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You declined the request, so TrueMail wasn't connected.",
  oauth_not_configured: "Resend OAuth isn't configured on this server yet.",
  invalid_callback: "The connection attempt was invalid. Please try again.",
  state_mismatch: "The connection attempt expired. Please try again.",
  webhook_base_url_not_https:
    "RESEND_WEBHOOK_BASE_URL (or APP_URL) must be a public HTTPS URL so Resend can deliver webhooks.",
  token_exchange_failed: "Resend rejected the connection. Please try again.",
  webhook_registration_failed: "Connected, but failed to register the webhook. Please try again.",
};

export default function ConnectResendPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = use(searchParams);

  return (
    <AuthShell wide showSignOut>
      <OnboardingSteps current={1} />
      <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
        <EnvelopeSimple size={22} weight="bold" />
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
        Connect your Resend account
      </h1>
      <p className="mb-8 text-sm text-text-secondary">
        TrueMail sends and receives email through your own Resend account.
        You&apos;ll be asked to approve access on Resend&apos;s site — no API key to copy.
      </p>
      {error && (
        <p className="mb-4 text-sm text-red-600">
          {ERROR_MESSAGES[error] ?? "Something went wrong connecting to Resend. Please try again."}
        </p>
      )}
      <DrawablyLinkButton href="/api/oauth/resend/start" className="self-start">
        Connect with Resend
      </DrawablyLinkButton>
    </AuthShell>
  );
}
