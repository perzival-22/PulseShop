import type { StorageService } from "../types";
import { requireUserId, supabase } from "./client";

const BUCKET = "media";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Best-effort file extension from the file name/type, defaulting to jpg. */
function extFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = file.type.split("/").pop();
  return fromType || "jpg";
}

/**
 * Uploads images to the public `media` bucket under `<folder>/<uid>/<uuid>.<ext>`
 * and returns the public URL. RLS lets authenticated merchants write; anyone reads.
 */
export const storageApi: StorageService = {
  async uploadImage(file: File, folder: string): Promise<string> {
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error("Only JPG, PNG, WEBP or GIF images are allowed");
    }
    if (file.size > MAX_BYTES) {
      throw new Error("Image must be under 5MB");
    }

    const uid = await requireUserId();
    const path = `${folder}/${uid}/${crypto.randomUUID()}.${extFor(file)}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  async deleteImage(url: string): Promise<void> {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = url.indexOf(marker);
    if (i === -1) return; // not one of our uploads (e.g. the ui-avatars.com fallback) — nothing to clean up
    const path = decodeURIComponent(url.slice(i + marker.length));
    await supabase.storage.from(BUCKET).remove([path]);
  },
};
