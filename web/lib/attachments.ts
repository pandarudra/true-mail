export type AttachmentInput = {
  publicId: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
};

// Client sends the Cloudinary upload result for each attached file; this
// validates the shape before it reaches a Prisma nested write.
export function parseAttachments(value: unknown): AttachmentInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (a): a is Record<string, unknown> =>
        !!a &&
        typeof a === "object" &&
        typeof (a as Record<string, unknown>).url === "string" &&
        (a as Record<string, unknown>).url !== "" &&
        typeof (a as Record<string, unknown>).filename === "string"
    )
    .map((a) => ({
      publicId: typeof a.publicId === "string" ? a.publicId : "",
      url: a.url as string,
      filename: a.filename as string,
      contentType: typeof a.contentType === "string" ? a.contentType : "application/octet-stream",
      size: typeof a.size === "number" ? a.size : 0,
    }));
}

export function attachmentsCreateData(value: unknown) {
  return parseAttachments(value).map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
    cloudinaryUrl: a.url,
    cloudinaryPublicId: a.publicId,
  }));
}
