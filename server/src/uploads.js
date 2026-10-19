import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { config } from './config.js';
import { badRequest, randomToken } from './utils.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(badRequest('Only image files are allowed'));
  },
});

/**
 * Stores an uploaded image and returns its public URL. Raster images are
 * resized to at most `maxSize` px and converted to WebP, so phone photos of
 * several MB become ~150 KB and pages stay fast.
 */
export async function saveImage(file, { maxSize = 1600 } = {}) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const id = `${Date.now().toString(36)}-${randomToken(6)}`;
  if (file.mimetype === 'image/svg+xml') {
    // SVGs are kept for logos; they are served with a strict CSP (see app.js).
    const name = `${id}.svg`;
    fs.writeFileSync(path.join(config.uploadsDir, name), file.buffer);
    return `/uploads/${name}`;
  }
  const name = `${id}.webp`;
  try {
    await sharp(file.buffer, { animated: file.mimetype === 'image/gif' })
      .rotate()
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(config.uploadsDir, name));
  } catch {
    throw badRequest('Could not read image file');
  }
  return `/uploads/${name}`;
}

export function deleteUpload(url) {
  if (!url?.startsWith('/uploads/')) return;
  const file = path.join(config.uploadsDir, path.basename(url));
  fs.rm(file, { force: true }, () => {});
}
