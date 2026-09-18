"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "@phosphor-icons/react";
import { CldUploadWidget } from "next-cloudinary";
import { DrawablyCard, DrawablyDivider } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

type User = { name: string; email: string; image: string | null };

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function initialOf(user: User): string {
  return (user.name || user.email).charAt(0).toUpperCase();
}

interface CloudinaryUploadInfo {
  secure_url: string;
}

function isUploadInfo(info: unknown): info is CloudinaryUploadInfo {
  return typeof info === "object" && info !== null && "secure_url" in info;
}

export function SettingsClient({ user: initialUser }: { user: User }) {
  const router = useRouter();
  const [image, setImage] = useState(initialUser.image);
  const [name, setName] = useState(initialUser.name);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    await authClient.updateUser({ name });
    setSaving(false);
    setStatus("Saved");
  }

  async function handleAvatarUploaded(url: string) {
    setUploading(false);
    setImage(url);
    await authClient.updateUser({ image: url });
  }

  return (
    <main className="flex min-h-screen justify-center bg-surface-subtle px-4 py-12">
      <DrawablyCard roughness={0.3} boil={0.1} className="w-full max-w-lg bg-surface p-8">
        <button
          type="button"
          onClick={() => router.push("/inbox")}
          className="mb-6 flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to inbox
        </button>
        <h1 className="mb-6 text-xl font-semibold text-foreground">Profile</h1>

        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {initialOf({ name, email: initialUser.email, image })}
              </div>
            )}
          </div>
          <CldUploadWidget
            signatureEndpoint="/api/sign-cloudinary-params"
            options={{ sources: ["local"], multiple: false, maxFiles: 1, maxFileSize: MAX_AVATAR_BYTES }}
            onOpen={() => setUploading(true)}
            onSuccess={(result) => {
              if (isUploadInfo(result?.info)) void handleAvatarUploaded(result.info.secure_url);
            }}
            onClose={() => setUploading(false)}
          >
            {({ open }) => (
              <Button type="button" variant="secondary" onClick={() => open()} className="w-fit">
                <Camera size={16} />
                {uploading ? "Uploading…" : "Change photo"}
              </Button>
            )}
          </CldUploadWidget>
        </div>

        <DrawablyDivider roughness={0.3} boil={0.1} className="my-6" />

        <form onSubmit={handleSaveName} className="flex flex-col gap-4">
          <div>
            <label className="flex items-center gap-3 py-2 text-sm">
              <span className="w-20 shrink-0 text-text-secondary">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-transparent text-foreground outline-none"
              />
            </label>
            <DrawablyDivider roughness={0.3} boil={0.1} />
          </div>
          <div>
            <label className="flex items-center gap-3 py-2 text-sm">
              <span className="w-20 shrink-0 text-text-secondary">Email</span>
              <span className="flex-1 truncate text-text-secondary">{initialUser.email}</span>
            </label>
            <DrawablyDivider roughness={0.3} boil={0.1} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? "Saving..." : "Save"}
            </Button>
            {status && <span className="text-sm text-text-secondary">{status}</span>}
          </div>
        </form>
      </DrawablyCard>
    </main>
  );
}
