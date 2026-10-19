export function normalizeYouTubeForIframe(url) {
  try {
    const u = new URL(url);
    const host = String(u.hostname || '').toLowerCase();

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : url;
    }

    if (host.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : url;
      }
      if (u.pathname.startsWith('/shorts/')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const id = parts[0] === 'shorts' ? parts[1] : null;
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : url;
      }
      if (u.pathname.startsWith('/embed/')) return url;
    }

    return url;
  } catch {
    return url;
  }
}

export function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/i.test(String(url || ''));
}
