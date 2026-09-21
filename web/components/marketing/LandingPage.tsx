"use client";

import {
  ArrowBendUpLeft,
  At,
  CheckSquare,
  EnvelopeSimple,
  Globe,
  LockKey,
  Moon,
  PlugsConnected,
  Robot,
  ShieldCheck,
} from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyDivider } from "drawably/react";
import { BrandMark } from "@/components/BrandMark";
import { DrawablyLinkButton } from "@/components/ui/DrawablyLinkButton";
import { InboxPreview } from "@/components/marketing/InboxPreview";

const FEATURES = [
  {
    icon: Globe,
    title: "Custom domain, verified",
    body: "Add your domain, verify SPF/DKIM/DMARC, and send from an address that's actually yours.",
  },
  {
    icon: PlugsConnected,
    title: "Your own Resend account",
    body: "Connect your Resend credentials once — encrypted at rest, and never sent to the browser.",
  },
  {
    icon: EnvelopeSimple,
    title: "A real inbox",
    body: "Labels, drafts that autosave, attachments, search, starred, archive, spam, trash — the parts you actually use.",
  },
  {
    icon: ArrowBendUpLeft,
    title: "Reply, forward, and threading",
    body: "Quoted replies, reply-all, and forwarding that behaves the way you'd expect.",
  },
  {
    icon: At,
    title: "Multiple mailboxes",
    body: "Run as many addresses as you need on one domain, with a primary you can switch anytime.",
  },
  {
    icon: CheckSquare,
    title: "Tasks, right where email lives",
    body: "Turn any email into a task with one click. Tasks stay linked back to the email they came from, with due dates, priorities, and lists.",
  },
  {
    icon: Robot,
    title: "AI that acts on your inbox",
    body: "Summarize an email, extract its action items straight into tasks, or type a task in plain English and let AI fill in the title and due date.",
  },
  {
    icon: Moon,
    title: "Dark mode",
    body: "Because you'll be living in it.",
  },
] as const;

const STEPS = [
  {
    title: "Connect your Resend account",
    body: "Authorize once; your credentials are encrypted and stored server-side only.",
  },
  {
    title: "Verify your domain",
    body: "Add the DNS records we generate. We check verification status automatically.",
  },
  {
    title: "Send and receive",
    body: "Create a mailbox and mail starts flowing — sent through Resend, received via webhook.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink relative overflow-hidden">
        <div className="bg-grain-texture pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />

        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <BrandMark light />
          <a
            href="/login"
            className="text-sm text-white/70 transition-colors hover:text-white"
          >
            Sign in
          </a>
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Run email on infrastructure you control.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
              TrueMail connects to your own Resend account and your own domain, then gives you a
              fast, modern inbox on top. No shared infrastructure, no one else holding your mail.
            </p>
            <div className="mt-8 flex items-center gap-6">
              <DrawablyLinkButton href="/signup" variant="solid" className="text-base">
                Get started
              </DrawablyLinkButton>
              <a
                href="#how-it-works"
                className="text-sm text-white/70 underline underline-offset-4 transition-colors hover:text-white"
              >
                See how it works
              </a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <InboxPreview />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-lg text-2xl font-semibold text-foreground">What&rsquo;s included</h2>
        <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
                <Icon size={20} weight="bold" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <DrawablyDivider roughness={0.3} boil={0.1} className="mx-auto max-w-6xl" />

      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-lg text-2xl font-semibold text-foreground">How it works</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <DrawablyBadge roughness={0.4} boil={0.15} className="text-sm font-semibold">
                {i + 1}
              </DrawablyBadge>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink relative overflow-hidden">
        <div className="bg-grain-texture pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <h2 className="max-w-lg text-2xl font-semibold text-white">
            Your Resend key never touches the browser.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="flex gap-3">
              <LockKey size={20} weight="bold" className="mt-0.5 shrink-0 text-brand-300" />
              <p className="text-sm leading-relaxed text-white/70">
                Credentials are encrypted at rest and only ever used from TrueMail&rsquo;s backend.
              </p>
            </div>
            <div className="flex gap-3">
              <ShieldCheck size={20} weight="bold" className="mt-0.5 shrink-0 text-brand-300" />
              <p className="text-sm leading-relaxed text-white/70">
                Every inbound webhook is signature-verified before we touch it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center">
        <BrandMark />
        <div className="flex items-center gap-6">
          <a
            href="/login"
            className="text-sm text-text-secondary transition-colors hover:text-foreground"
          >
            Sign in
          </a>
          <DrawablyLinkButton href="/signup">Get started</DrawablyLinkButton>
        </div>
      </footer>
    </div>
  );
}
