export function parseColor(input, fallback = '#ffffff') {
  if (!input) return fallback;
  const ctx = document.createElement('canvas').getContext('2d');
  try {
    ctx.fillStyle = input;
    return ctx.fillStyle;
  } catch (err) {
    console.warn('Unable to parse color', input, err);
    return fallback;
  }
}

export function toRgba(color, alpha = 1) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = color;
  const computed = ctx.fillStyle;
  if (computed.startsWith('#')) {
    const value = computed.substring(1);
    const bigint = parseInt(value, 16);
    if (value.length === 3) {
      const r = (bigint >> 8) & 0xf;
      const g = (bigint >> 4) & 0xf;
      const b = bigint & 0xf;
      return `rgba(${r * 17}, ${g * 17}, ${b * 17}, ${alpha})`;
    }
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return computed.replace(/rgba?\(([^)]+)\)/, (_, rgb) => `rgba(${rgb.split(',').slice(0, 3).join(',')}, ${alpha})`);
}

export function getReadableTextColor(color) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = color;
  const computed = ctx.fillStyle;
  let r, g, b;
  if (computed.startsWith('#')) {
    const value = computed.substring(1);
    const bigint = parseInt(value, 16);
    if (value.length === 3) {
      r = ((bigint >> 8) & 0xf) * 17;
      g = ((bigint >> 4) & 0xf) * 17;
      b = (bigint & 0xf) * 17;
    } else {
      r = (bigint >> 16) & 255;
      g = (bigint >> 8) & 255;
      b = bigint & 255;
    }
  } else {
    const matches = /rgba?\(([^)]+)\)/.exec(computed);
    if (!matches) return '#111827';
    const parts = matches[1].split(',').map((value) => Number(value.trim()));
    [r, g, b] = parts;
  }
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? '#111827' : '#ffffff';
}

export function resolveAsset(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) {
    return path;
  }
  const base = document.currentScript?.src ?? window.location.href;
  const url = new URL(path, base);
  return url.href;
}

export function setBrandingVariables(branding = {}) {
  if (!branding) return;
  const root = document.documentElement;
  if (branding.backgroundColor) {
    root.style.setProperty('--portal-background', branding.backgroundColor);
  }
  if (branding.accentColor) {
    root.style.setProperty('--portal-accent', branding.accentColor);
    const contrast = getReadableTextColor(branding.accentColor);
    root.style.setProperty('--portal-accent-foreground', branding.accentForeground || contrast);
  }
  if (branding.cardBackground) {
    root.style.setProperty('--portal-card-background', branding.cardBackground);
  }
  if (branding.cardBackdrop) {
    root.style.setProperty('--portal-card-backdrop', branding.cardBackdrop);
  }
}

export function debounce(fn, wait = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

export const defaultRoles = ['anonymous', 'parents', 'students', 'staff'];

export const iconLibrary = [
  'academic-cap',
  'badge-check',
  'bell',
  'book-open',
  'calendar',
  'chat-bubble',
  'clock',
  'cloud-arrow-down',
  'device-phone',
  'document',
  'globe',
  'home',
  'id-card',
  'information-circle',
  'lifebuoy',
  'lock-closed',
  'megaphone',
  'shield-check',
  'sparkles',
  'support',
  'users'
];

export function buildLinkIcon(name) {
  if (!name) return '🔗';
  const label = name.replace(/-/g, ' ');
  return label[0]?.toUpperCase() ?? '🔗';
}

export function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function persistLocal(key, value) {
  if (value === undefined) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function announce(message) {
  const toast = document.querySelector('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3200);
}
