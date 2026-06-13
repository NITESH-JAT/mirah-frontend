function isLikelyImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  const base = (raw.split('?')[0] || raw).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].some((ext) => base.endsWith(ext));
}

function coerceAttachmentUrls(input) {
  const raw = input ?? [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
    } catch {
      return [trimmed];
    }
  }
  return raw ? [raw] : [];
}

function attachmentUrlOf(item) {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    return String(item.url ?? item.href ?? item.src ?? item.publicUrl ?? item.public_url ?? '').trim();
  }
  return '';
}

/** Same thumbnail resolution as vendor Bids / Explore cards. */
export function pickProjectThumbnailUrl(project) {
  if (!project || typeof project !== 'object') return null;

  const referenceImage = String(project.referenceImage ?? project.reference_image ?? '').trim();
  if (referenceImage && /^https?:\/\//i.test(referenceImage)) return referenceImage;

  const list = coerceAttachmentUrls(
    project.attachments ?? project.attachmentUrls ?? project.attachment_urls ?? [],
  );
  const urls = list.map(attachmentUrlOf).filter(Boolean);
  const img = urls.find((u) => isLikelyImageUrl(u));
  if (img) return img;

  return urls.find((u) => /^https?:\/\//i.test(u)) || null;
}
