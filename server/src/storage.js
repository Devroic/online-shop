import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { badRequest, randomToken } from './utils.js';

// Product photos, logos and banners. In production they live in the shop's
// Supabase Storage bucket; locally (no Supabase keys) in data/uploads.
// Photos are resized to WebP in the admin's browser before upload, so files
// stay small and under Vercel's ~4.5 MB request limit.

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => (TYPES[file.mimetype] ? cb(null, true) : cb(badRequest('Only image files are allowed'))),
});

let client;
export function supabaseAdmin() {
  const { url, serviceKey } = config.supabase;
  if (!url || !serviceKey) return null;
  client ??= createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const storageMode = () => (supabaseAdmin() ? 'supabase' : 'local');

/** Creates the public bucket if it doesn't exist (used by the setup script). */
export async function ensureBucket() {
  const sb = supabaseAdmin();
  if (!sb) return false;
  const { data } = await sb.storage.getBucket(config.supabase.bucket);
  if (!data) {
    const { error } = await sb.storage.createBucket(config.supabase.bucket, {
      public: true,
      fileSizeLimit: '5MB',
      allowedMimeTypes: Object.keys(TYPES),
    });
    if (error) throw error;
  }
  return true;
}

/** Stores an image buffer and returns its public URL. */
export async function saveFile(buffer, mimetype) {
  const ext = TYPES[mimetype];
  if (!ext) throw badRequest('Only image files are allowed');
  const name = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${randomToken(6)}.${ext}`;
  const sb = supabaseAdmin();
  if (sb) {
    const put = () =>
      sb.storage.from(config.supabase.bucket).upload(name, buffer, { contentType: mimetype, cacheControl: '31536000', upsert: false });
    let { error } = await put();
    // A shop deployed straight to Vercel has no bucket until its first upload.
    if (error && /bucket not found/i.test(error.message)) {
      await ensureBucket();
      ({ error } = await put());
    }
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return sb.storage.from(config.supabase.bucket).getPublicUrl(name).data.publicUrl;
  }
  const file = path.join(config.uploadsDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  return `/uploads/${name}`;
}

/** Deletes a stored image; ignores URLs we don't own. Never throws. */
export async function deleteFile(url) {
  if (!url) return;
  try {
    const sb = supabaseAdmin();
    const marker = `/storage/v1/object/public/${config.supabase.bucket}/`;
    if (sb && url.includes(marker)) {
      await sb.storage.from(config.supabase.bucket).remove([decodeURIComponent(url.split(marker)[1])]);
    } else if (url.startsWith('/uploads/')) {
      const file = path.resolve(config.uploadsDir, url.slice('/uploads/'.length));
      if (file.startsWith(path.resolve(config.uploadsDir))) fs.rmSync(file, { force: true });
    }
  } catch (err) {
    console.error('[storage] delete failed:', err.message);
  }
}
