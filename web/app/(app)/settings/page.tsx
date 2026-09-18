import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;

  return (
    <SettingsClient
      user={{
        name: session.user.name ?? "",
        email: session.user.email,
        image: session.user.image ?? null,
      }}
    />
  );
}
