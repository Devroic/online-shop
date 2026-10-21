import { getLanguage, t } from './i18n.js';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || {};
  }
}

async function request(method, url, body) {
  const isForm = body instanceof FormData;
  // The server uses the visitor's language for emails (order confirmation, welcome…).
  const headers = { 'X-Shop-Lang': getLanguage() };
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  // Server messages are written in English; show them in the shop's language.
  if (!res.ok) throw new ApiError(res.status, t(data?.error || res.statusText), data?.details);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
  /** Resizes photos in the browser, then uploads them (one request per file keeps each small). */
  upload: async (files, kind) => {
    const { resizeImage } = await import('./resizeImage.js');
    const urls = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append('files', await resizeImage(f, kind === 'logo' ? 600 : 1600));
      urls.push(...(await request('POST', '/admin/uploads', fd)).urls);
    }
    return { urls };
  },
};

export const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return s ? `?${s}` : '';
};
