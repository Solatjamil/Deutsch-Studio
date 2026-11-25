let csrfToken = '';
let csrfPromise: Promise<void> | null = null;

export async function bootstrapCsrf(): Promise<void> {
  if (csrfToken) return;
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/csrf', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { csrfToken = d.csrfToken; })
      .catch(() => { /* offline: calls will show an error */ })
      .finally(() => { csrfPromise = null; });
  }
  return csrfPromise;
}

async function request(path: string, init: RequestInit = {}, retry = true): Promise<any> {
  await bootstrapCsrf();
  const isForm = init.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      'x-csrf-token': csrfToken,
      ...(init.headers || {}),
    },
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST', credentials: 'include',
      headers: { 'x-csrf-token': csrfToken },
    });
    if (refreshed.ok) return request(path, init, false);
    window.dispatchEvent(new Event('auth:expired'));
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json()
    : type.includes('pdf') ? await res.blob()
    : await res.text();
  if (!res.ok) throw Object.assign(new Error((data as any)?.error || `Request failed (${res.status})`), {
    status: res.status, details: (data as any)?.details,
  });
  return data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path: string, body?: any) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path: string) => request(path, { method: 'DELETE' }),
  upload: (path: string, form: FormData) => request(path, { method: 'POST', body: form }),
  download: async (path: string, filename: string) => {
    await bootstrapCsrf();
    const res = await fetch(`/api${path}`, { credentials: 'include', headers: { 'x-csrf-token': csrfToken } });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
