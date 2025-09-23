const PORTAL_LINKS_STORAGE_KEY = 'portalLinksConfig';
const ADMIN_SESSION_KEY = 'portalAdminSession';
const ADMIN_SESSION_VALUE = 'authenticated';
const ROLE_ORDER = ['anonymous', 'parents', 'students', 'staff'];
const ROLE_LABELS = {
  anonymous: 'Anonymous (guests)',
  parents: 'Parents & Guardians',
  students: 'Students',
  staff: 'Staff'
};


const PortalColorUtils =
  window.PortalColorUtils ||
  (window.PortalColorUtils = (() => {
    let colorProbeElement = null;

    function getColorProbeElement() {
      if (!colorProbeElement) {
        colorProbeElement = document.createElement('span');
        colorProbeElement.style.display = 'none';
        document.body.appendChild(colorProbeElement);
      }
      return colorProbeElement;
    }

    function isValidCssColor(value) {
      if (typeof value !== 'string') {
        return false;
      }

      const test = document.createElement('option');
      test.style.color = '';
      test.style.color = value.trim();
      return Boolean(test.style.color);
    }

    function componentToHex(value) {
      const clamped = Math.min(255, Math.max(0, Math.round(Number(value))));
      return clamped.toString(16).padStart(2, '0');
    }

    function normaliseColorValue(value) {
      if (typeof value !== 'string') {
        return null;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      const lower = trimmed.toLowerCase();
      if (lower === 'transparent') {
        return 'transparent';
      }

      if (!isValidCssColor(trimmed)) {
        return null;
      }

      const probe = getColorProbeElement();
      const previous = probe.style.color;
      probe.style.color = trimmed;
      const computed = window.getComputedStyle(probe).color;
      probe.style.color = previous;

      const match = computed.match(/rgba?\(([^)]+)\)/i);
      if (!match) {
        return null;
      }

      const parts = match[1].split(',').map((part) => part.trim());
      if (parts.length < 3) {
        return null;
      }

      const [rRaw, gRaw, bRaw, aRaw] = parts;
      const r = Number(rRaw);
      const g = Number(gRaw);
      const b = Number(bRaw);

      if ([r, g, b].some((component) => Number.isNaN(component))) {
        return null;
      }

      const alpha = Number.isNaN(Number(aRaw)) ? 1 : Number(aRaw);
      const clampedAlpha = Math.min(1, Math.max(0, alpha));

      const hexBase = `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
      if (clampedAlpha < 1) {
        const alphaHex = componentToHex(clampedAlpha * 255);
        if (alphaHex !== 'ff') {
          return `${hexBase}${alphaHex}`.toLowerCase();
        }
      }

      return hexBase.toLowerCase();
    }

    function normaliseColorMap(map = {}) {
      const normalised = {};
      if (!map || typeof map !== 'object') {
        return normalised;
      }

      Object.entries(map).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          return;
        }
        const normalisedValue = normaliseColorValue(value);
        if (normalisedValue !== null && normalisedValue !== undefined) {
          normalised[key] = normalisedValue;
        }
      });

      return normalised;
    }

    function resolveColorToRgbComponents(value) {
      if (!value || !document || !document.body) {
        return null;
      }

      const probe = document.createElement('span');
      probe.style.color = value;
      probe.style.display = 'none';
      document.body.appendChild(probe);
      const computedColor = window.getComputedStyle(probe).color;
      probe.remove();

      const match = computedColor.match(/rgba?\(([^)]+)\)/i);
      if (!match) {
        return null;
      }

      const parts = match[1].split(',').map((part) => part.trim());
      if (parts.length < 3) {
        return null;
      }

      return parts.slice(0, 3).join(', ');
    }

    function parseHexColor(value) {
      if (typeof value !== 'string') {
        return null;
      }

      const match = value.trim().toLowerCase().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
      if (!match) {
        return null;
      }

      const base = match[1];
      const alpha = match[2];

      return {
        r: parseInt(base.slice(0, 2), 16),
        g: parseInt(base.slice(2, 4), 16),
        b: parseInt(base.slice(4, 6), 16),
        a: alpha ? parseInt(alpha, 16) / 255 : 1
      };
    }

    function getReadableTextColor(color) {
      const parsed = parseHexColor(color);
      if (!parsed) {
        return '#1f2937';
      }

      const brightness = (parsed.r * 299 + parsed.g * 587 + parsed.b * 114) / 1000;
      return brightness > 155 ? '#111827' : '#ffffff';
    }

    function combineColorWithAlpha(value, alpha) {
      if (typeof value !== 'string') {
        return null;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      if (trimmed.toLowerCase() === 'transparent') {
        return 'transparent';
      }

      const numericAlpha = typeof alpha === 'string' ? Number(alpha) : alpha;
      if (typeof numericAlpha !== 'number' || Number.isNaN(numericAlpha)) {
        return trimmed;
      }

      const clamped = Math.min(1, Math.max(0, numericAlpha));
      const rgb = resolveColorToRgbComponents(trimmed);
      if (!rgb) {
        return trimmed;
      }

      const alphaString = clamped === 1 ? '1' : clamped.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      return `rgba(${rgb}, ${alphaString})`;
    }

    return {
      normaliseColorValue,
      normaliseColorMap,
      resolveColorToRgbComponents,
      parseHexColor,
      getReadableTextColor,
      combineColorWithAlpha
    };
  })());

const {
  normaliseColorValue,
  normaliseColorMap,
  parseHexColor,
  getReadableTextColor,
  resolveColorToRgbComponents,
  combineColorWithAlpha
} = PortalColorUtils;

const PortalAssetUtils =
  window.PortalAssetUtils ||
  (window.PortalAssetUtils = (() => {
    let cachedBaseUrl = null;

    function determineBaseUrl() {
      if (cachedBaseUrl) {
        return cachedBaseUrl;
      }

      let baseCandidate = null;

      if (document.currentScript && document.currentScript.src) {
        baseCandidate = document.currentScript.src;
      } else {
        const scripts = document.getElementsByTagName('script');
        for (let index = scripts.length - 1; index >= 0; index -= 1) {
          if (scripts[index].src) {
            baseCandidate = scripts[index].src;
            break;
          }
        }
      }

      if (!baseCandidate) {
        baseCandidate = window.location.href;
      }

      try {
        cachedBaseUrl = new URL('.', baseCandidate).toString();
      } catch (error) {
        cachedBaseUrl = window.location.origin ? `${window.location.origin}/` : '/';
      }

      return cachedBaseUrl;
    }

    function resolveUrl(path) {
      try {
        return new URL(path, determineBaseUrl()).toString();
      } catch (error) {
        try {
          return new URL(path, window.location.href).toString();
        } catch (innerError) {
          return path;
        }
      }
    }

    return { resolveUrl };
  })());

const { resolveUrl: resolvePortalAssetUrl } = PortalAssetUtils;

const COLOR_VARIABLE_MAP = {
  background: '--color-background',
  surface: '--color-surface',
  surfaceSubtle: '--color-surface-subtle',
  primary: '--color-primary',
  primaryDark: '--color-primary-dark',
  primaryAccent: '--color-primary-accent',
  text: '--color-text',
  muted: '--color-muted',
  border: '--color-border',
  headerOverlay: '--color-header-overlay',
  sessionButtonBackground: '--color-session-button-background',
  emptyStateBackground: '--color-empty-state-background',
  tertiaryButtonBackground: '--color-tertiary-background',
  danger: '--color-danger',
  footerBackground: '--color-footer-background',
  footerText: '--color-footer-text',
  footerLink: '--color-footer-link'
};

const TRANSPARENCY_TARGETS = {
  panel: {
    cssVar: '--color-surface',
    colorKey: 'surface'
  },
  header: {
    cssVar: '--color-header-surface',
    colorKey: 'surface',
    fallbackVar: '--color-surface'
  },
  footer: {
    cssVar: '--color-footer-background',
    colorKey: 'footerBackground'
  },
  button: {
    cssVar: '--color-session-button-background',
    colorKey: 'sessionButtonBackground'
  }
};

const COLOR_FIELDS = [
  { key: 'background', label: 'Page background colour', placeholder: '#f5f7fb' },
  { key: 'surface', label: 'Main surface colour', placeholder: '#ffffff' },
  { key: 'surfaceSubtle', label: 'Subtle surface background', placeholder: '#f7faff99' },
  { key: 'primary', label: 'Primary brand colour', placeholder: '#1d4ed8' },
  { key: 'primaryDark', label: 'Primary dark colour', placeholder: '#1a3696' },
  { key: 'primaryAccent', label: 'Primary accent colour', placeholder: '#2563eb' },
  { key: 'text', label: 'Main text colour', placeholder: '#1f2937' },
  { key: 'muted', label: 'Muted text colour', placeholder: '#6b7280' },
  { key: 'border', label: 'Border colour', placeholder: '#e5e7eb' },
  { key: 'headerOverlay', label: 'Header overlay colour', placeholder: '#ffffffd9' },
  { key: 'sessionButtonBackground', label: 'Button background colour', placeholder: '#ffffffd9' },
  { key: 'emptyStateBackground', label: 'Empty state background', placeholder: '#6b72801f' },
  { key: 'tertiaryButtonBackground', label: 'Secondary surface colour', placeholder: '#ffffff' },
  { key: 'danger', label: 'Danger colour', placeholder: '#dc2626' },
  { key: 'footerBackground', label: 'Footer background colour', placeholder: '#ffffff' },
  { key: 'footerText', label: 'Footer text colour', placeholder: '#6b7280' },
  { key: 'footerLink', label: 'Footer link colour', placeholder: '#1d4ed8' }
];

const TRANSPARENCY_FIELDS = [
  { key: 'panel', label: 'Link grid glass opacity', default: 0.8 },
  { key: 'header', label: 'Header glass opacity', default: 0.72 },
  { key: 'footer', label: 'Footer glass opacity', default: 0.65 },
  { key: 'button', label: 'Button background opacity', default: 0.75 }
];

const ICON_LIBRARY = [
  { label: 'Shield star', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/shield-star.svg' },
  { label: 'School building', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/school.svg' },
  { label: 'Calendar', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/calendar.svg' },
  { label: 'Book', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/book.svg' },
  { label: 'Report analytics', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/report-analytics.svg' },
  { label: 'Credit card', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/credit-card.svg' },
  { label: 'Home', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/home.svg' },
  { label: 'Users group', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/users.svg' },
  { label: 'Laptop', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/device-laptop.svg' },
  { label: 'Clipboard list', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/clipboard-list.svg' },
  { label: 'Help circle', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/help.svg' },
  { label: 'Tools', url: 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/tools.svg' }
];

let iconDatalistElement = null;

function setColorInputPreview(input, color) {
  if (!input) {
    return;
  }

  if (color) {
    input.style.backgroundColor = color;
    input.style.color = getReadableTextColor(color);
  } else {
    input.style.backgroundColor = '';
    input.style.color = '';
  }
}

function updateColorInputPreviewFromState(input, markInvalid = false, commitValue = true) {
  if (!input) {
    return true;
  }

  const raw = typeof input.value === 'string' ? input.value.trim() : '';
  if (!raw) {
    input.classList.remove('color-input--invalid');
    input.dataset.lastPreviewColor = 'transparent';
    setColorInputPreview(input, 'transparent');
    return true;
  }

  const normalisedValue = normaliseColorValue(raw);
  if (!normalisedValue) {
    const fallback = input.dataset.lastPreviewColor || input.dataset.defaultColor || '';
    setColorInputPreview(input, fallback);
    if (markInvalid) {
      input.classList.add('color-input--invalid');
      input.style.color = '';
    } else {
      input.classList.remove('color-input--invalid');
    }
    return false;
  }

  if (commitValue && normalisedValue !== raw) {
    input.value = normalisedValue;
  }

  input.classList.remove('color-input--invalid');
  input.dataset.lastPreviewColor = normalisedValue;
  setColorInputPreview(input, normalisedValue);
  return true;
}

function initialiseColorInput(input, defaultColor) {
  if (!input) {
    return;
  }

  if (defaultColor) {
    input.dataset.defaultColor = defaultColor;
    input.dataset.lastPreviewColor = defaultColor;
  } else {
    delete input.dataset.defaultColor;
    delete input.dataset.lastPreviewColor;
  }

  updateColorInputPreviewFromState(input, true);

  input.addEventListener('input', () => {
    updateColorInputPreviewFromState(input, false, false);
  });

  const handleValidation = () => {
    const isValid = updateColorInputPreviewFromState(input, true);
    if (!isValid && input.dataset.fieldLabel) {
      showConsoleMessage(`"${input.dataset.fieldLabel}" must be a valid CSS colour.`, true);
    }
  };

  input.addEventListener('change', handleValidation);
  input.addEventListener('blur', handleValidation);
}

function ensureIconDatalist() {
  if (iconDatalistElement) {
    return iconDatalistElement;
  }

  iconDatalistElement = document.createElement('datalist');
  iconDatalistElement.id = 'icon-url-options';
  ICON_LIBRARY.forEach((icon) => {
    const option = document.createElement('option');
    option.value = icon.url;
    option.label = icon.label;
    iconDatalistElement.appendChild(option);
  });
  document.body.appendChild(iconDatalistElement);
  return iconDatalistElement;
}

function attachIconPicker(input) {
  if (!input) {
    return;
  }

  const datalist = ensureIconDatalist();
  input.setAttribute('list', datalist.id);
}

const loginSection = document.getElementById('admin-login');
const loginForm = document.getElementById('admin-login-form');
const loginStatus = document.getElementById('admin-login-status');
const consoleSection = document.getElementById('admin-console');
const consoleStatus = document.getElementById('admin-console-status');
const logoutButton = document.getElementById('admin-logout');
const brandingContainer = document.getElementById('branding-container');
const rolesContainer = document.getElementById('roles-container');
const adminSiteHeader = document.getElementById('admin-site-header');
const adminBrandLogoWrapper = document.getElementById('admin-brand-logo');
const adminPortalLogoElement = document.getElementById('admin-portal-logo');
const adminPortalNameElement = document.getElementById('admin-portal-name');
const adminPortalTaglineElement = document.getElementById('admin-portal-tagline');
const adminFooterElement = document.getElementById('admin-site-footer');
const adminPrivacyPolicyLinkElement = document.getElementById('admin-privacy-policy-link');
const adminCopyrightElement = document.getElementById('admin-copyright');

const initialAdminPortalName = adminPortalNameElement ? adminPortalNameElement.textContent : '';
const initialAdminPortalTagline = adminPortalTaglineElement ? adminPortalTaglineElement.textContent : '';

let adminCredentials = { username: '', passwordHash: '' };
let defaultPortalConfig = { branding: {}, roles: {} };
let currentPortalConfig = { branding: {}, roles: {} };

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyColorVariablesToDocument(colors = {}) {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const normalisedColors = normaliseColorMap(colors);

  Object.entries(COLOR_VARIABLE_MAP).forEach(([key, variable]) => {
    const value = normalisedColors[key];
    if (value === undefined) {
      root.style.removeProperty(variable);
      return;
    }

    if (value === '' || (typeof value === 'string' && value.toLowerCase() === 'transparent')) {
      root.style.setProperty(variable, 'transparent');
      return;
    }

    root.style.setProperty(variable, value);
  });

  const primarySource =
    normalisedColors.primary || window.getComputedStyle(root).getPropertyValue('--color-primary');
  const primaryRgb = resolveColorToRgbComponents(primarySource.trim());
  if (primaryRgb) {
    root.style.setProperty('--color-primary-rgb', primaryRgb);
  }

  const textSource =
    normalisedColors.text || window.getComputedStyle(root).getPropertyValue('--color-text');
  const textRgb = resolveColorToRgbComponents(textSource.trim());
  if (textRgb) {
    root.style.setProperty('--color-text-rgb', textRgb);
  }

  const mutedSource =
    normalisedColors.muted || window.getComputedStyle(root).getPropertyValue('--color-muted');
  const mutedRgb = resolveColorToRgbComponents(mutedSource.trim());
  if (mutedRgb) {
    root.style.setProperty('--color-muted-rgb', mutedRgb);
  }
}

function normaliseTransparencyMap(map = {}) {
  const normalised = {};
  if (!map || typeof map !== 'object') {
    return normalised;
  }

  Object.entries(map).forEach(([key, value]) => {
    const numericValue = typeof value === 'string' ? Number(value) : value;
    if (typeof numericValue !== 'number' || Number.isNaN(numericValue)) {
      return;
    }

    const clamped = Math.min(1, Math.max(0, numericValue));
    normalised[key] = Number(clamped.toFixed(3));
  });

  return normalised;
}

function applyTransparencyVariablesToDocument(colors = {}, transparency = {}) {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const transparencyMap = normaliseTransparencyMap(transparency);
  const computedStyle = window.getComputedStyle(root);

  Object.entries(TRANSPARENCY_TARGETS).forEach(([key, target]) => {
    const { cssVar, colorKey, fallbackVar } = target;
    const opacity = transparencyMap[key];
    const hasColorOverride = colors && Object.prototype.hasOwnProperty.call(colors, colorKey);

    if (hasColorOverride) {
      const overrideValue = colors[colorKey];
      if (
        overrideValue === '' ||
        (typeof overrideValue === 'string' && overrideValue.trim().toLowerCase() === 'transparent')
      ) {
        root.style.setProperty(cssVar, 'transparent');
        return;
      }
    }

    if (opacity === undefined) {
      if (!hasColorOverride && cssVar === '--color-header-surface') {
        root.style.removeProperty(cssVar);
      }
      return;
    }

    let baseColor = '';
    if (hasColorOverride) {
      baseColor = colors[colorKey];
    }

    if (!baseColor && fallbackVar) {
      baseColor = computedStyle.getPropertyValue(fallbackVar).trim();
    }

    if (!baseColor) {
      baseColor = computedStyle.getPropertyValue(cssVar).trim();
    }

    if (!baseColor) {
      if (cssVar === '--color-header-surface') {
        root.style.removeProperty(cssVar);
      }
      return;
    }

    const trimmed = typeof baseColor === 'string' ? baseColor.trim() : '';
    if (!trimmed) {
      root.style.setProperty(cssVar, 'transparent');
      return;
    }

    if (trimmed.toLowerCase() === 'transparent') {
      root.style.setProperty(cssVar, 'transparent');
      return;
    }

    const result = combineColorWithAlpha(trimmed, opacity);
    if (result) {
      root.style.setProperty(cssVar, result);
    }
  });
}

function applyAdminFooterSettings(footerConfig = {}) {
  if (!adminFooterElement) {
    return;
  }

  if (adminPrivacyPolicyLinkElement) {
    const label =
      typeof footerConfig.privacyPolicyLabel === 'string'
        ? footerConfig.privacyPolicyLabel.trim()
        : '';
    const url =
      typeof footerConfig.privacyPolicyUrl === 'string'
        ? footerConfig.privacyPolicyUrl.trim()
        : '';

    const linkText = label || 'Privacy policy';
    adminPrivacyPolicyLinkElement.textContent = linkText;

    if (url) {
      adminPrivacyPolicyLinkElement.href = url;
      adminPrivacyPolicyLinkElement.classList.remove('hidden');
      adminPrivacyPolicyLinkElement.setAttribute('target', '_blank');
      adminPrivacyPolicyLinkElement.setAttribute('rel', 'noopener noreferrer');
    } else {
      adminPrivacyPolicyLinkElement.href = '#';
      adminPrivacyPolicyLinkElement.classList.add('hidden');
      adminPrivacyPolicyLinkElement.removeAttribute('target');
      adminPrivacyPolicyLinkElement.removeAttribute('rel');
    }
  }
}

function updateAdminCopyright(title) {
  if (!adminCopyrightElement) {
    return;
  }

  const currentYear = new Date().getFullYear();
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const portalTitle = trimmedTitle || initialAdminPortalName || 'PIPs Portal';
  adminCopyrightElement.textContent = `© ${currentYear} ${portalTitle}`;
}

function applyAdminBrandingTheme(branding = {}, options = {}) {
  const colors = normaliseColorMap(branding.colors || {});
  branding.colors = colors;
  applyColorVariablesToDocument(colors);

  const transparency = normaliseTransparencyMap(branding.transparency || {});
  branding.transparency = transparency;
  applyTransparencyVariablesToDocument(colors, transparency);

  const root = document.documentElement;
  if (root) {
    const pageBackgroundUrl =
      typeof branding.pageBackgroundImage === 'string' ? branding.pageBackgroundImage.trim() : '';
    if (pageBackgroundUrl) {
      const cssUrl = `url(${JSON.stringify(pageBackgroundUrl)})`;
      root.style.setProperty('--page-background-image', cssUrl);
    } else {
      root.style.setProperty('--page-background-image', 'none');
    }
  }

  const title = typeof branding.title === 'string' ? branding.title.trim() : '';
  const resolvedTitle = title || initialAdminPortalName || 'PIPs Portal';

  if (adminPortalNameElement) {
    adminPortalNameElement.textContent = resolvedTitle;
  }

  if (adminPortalTaglineElement) {
    const tagline = typeof branding.tagline === 'string' ? branding.tagline.trim() : '';
    const overrideExists = Boolean(options && options.taglineOverrideExists);
    const overrideTagline =
      options && typeof options.overrideTagline === 'string' ? options.overrideTagline.trim() : '';

    if (overrideExists && !overrideTagline) {
      adminPortalTaglineElement.textContent = '';
      adminPortalTaglineElement.classList.add('hidden');
    } else if (tagline) {
      adminPortalTaglineElement.textContent = tagline;
      adminPortalTaglineElement.classList.remove('hidden');
    } else if (initialAdminPortalTagline) {
      adminPortalTaglineElement.textContent = initialAdminPortalTagline;
      adminPortalTaglineElement.classList.remove('hidden');
    } else {
      adminPortalTaglineElement.textContent = '';
      adminPortalTaglineElement.classList.add('hidden');
    }
  }

  if (adminPortalLogoElement) {
    if (branding.logo) {
      adminPortalLogoElement.src = branding.logo;
      adminPortalLogoElement.classList.remove('hidden');
      if (adminBrandLogoWrapper) {
        adminBrandLogoWrapper.classList.remove('hidden');
      }
    } else {
      adminPortalLogoElement.removeAttribute('src');
      adminPortalLogoElement.classList.add('hidden');
      if (adminBrandLogoWrapper) {
        adminBrandLogoWrapper.classList.add('hidden');
      }
    }
  }

  if (adminSiteHeader) {
    if (branding.backgroundImage) {
      adminSiteHeader.style.setProperty('--header-background-image', `url(${branding.backgroundImage})`);
    } else {
      adminSiteHeader.style.removeProperty('--header-background-image');
    }
  }

  applyAdminFooterSettings(branding.footer || {});
  updateAdminCopyright(resolvedTitle);
}

function refreshAdminPreview() {
  const branding =
    currentPortalConfig && currentPortalConfig.branding && typeof currentPortalConfig.branding === 'object'
      ? currentPortalConfig.branding
      : {};
  const fallback =
    defaultPortalConfig && defaultPortalConfig.branding && typeof defaultPortalConfig.branding === 'object'
      ? defaultPortalConfig.branding
      : {};
  const mergedColors = normaliseColorMap({
    ...((fallback.colors && typeof fallback.colors === 'object') ? fallback.colors : {}),
    ...((branding.colors && typeof branding.colors === 'object') ? branding.colors : {})
  });

  const footerDefaults = fallback.footer && typeof fallback.footer === 'object' ? fallback.footer : {};
  const footerOverrides = branding.footer && typeof branding.footer === 'object' ? branding.footer : {};

  const mergedTransparency = {
    ...normaliseTransparencyMap(
      fallback.transparency && typeof fallback.transparency === 'object' ? fallback.transparency : {}
    ),
    ...normaliseTransparencyMap(
      branding.transparency && typeof branding.transparency === 'object' ? branding.transparency : {}
    )
  };

  const previewBranding = {
    ...fallback,
    ...branding,
    colors: mergedColors,
    footer: { ...footerDefaults, ...footerOverrides },
    transparency: mergedTransparency
  };

  const stored = getStoredPortalConfig();
  const storedBranding =
    stored && stored.branding && typeof stored.branding === 'object' ? stored.branding : {};
  const defaultHasTagline = Object.prototype.hasOwnProperty.call(fallback, 'tagline');
  const defaultTaglineValue = defaultHasTagline ? fallback.tagline : undefined;
  const storedHasTagline = Object.prototype.hasOwnProperty.call(storedBranding, 'tagline');
  let taglineOverrideExists = false;
  let overrideTagline = undefined;

  if (storedHasTagline) {
    overrideTagline = storedBranding.tagline;
    if (!defaultHasTagline) {
      taglineOverrideExists = true;
    } else {
      const storedTrimmed =
        typeof overrideTagline === 'string' ? overrideTagline.trim() : overrideTagline;
      const defaultTrimmed =
        typeof defaultTaglineValue === 'string' ? defaultTaglineValue.trim() : defaultTaglineValue;
      if (storedTrimmed !== defaultTrimmed) {
        taglineOverrideExists = true;
      }
    }
  }

  applyAdminBrandingTheme(previewBranding, {
    taglineOverrideExists,
    overrideTagline
  });
}

async function loadConfiguration() {
  const response = await fetch(resolvePortalAssetUrl('config.json'));
  if (!response.ok) {
    throw new Error(`Unable to load config.json (${response.status} ${response.statusText})`);
  }

  const config = await response.json();
  adminCredentials = config.admin || { username: '', passwordHash: '' };

  const portalBranding = (config.portal && config.portal.branding) || {};
  const brandingClone = deepClone(portalBranding || {});
  const brandingColors =
    brandingClone.colors && typeof brandingClone.colors === 'object' ? brandingClone.colors : {};
  const brandingFooter =
    brandingClone.footer && typeof brandingClone.footer === 'object' ? brandingClone.footer : {};

  brandingClone.colors = normaliseColorMap(brandingColors);
  brandingClone.footer = brandingFooter;
  const brandingTransparency =
    brandingClone.transparency && typeof brandingClone.transparency === 'object'
      ? brandingClone.transparency
      : {};
  brandingClone.transparency = normaliseTransparencyMap(brandingTransparency);

  defaultPortalConfig = {
    branding: brandingClone,
    roles: (config.portal && config.portal.roles) || {}
  };
}

function showLoginMessage(message, isError = false) {
  if (!loginStatus) {
    return;
  }
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? '#dc2626' : '';
}

function showConsoleMessage(message, isError = false) {
  if (!consoleStatus) {
    return;
  }
  consoleStatus.textContent = message;
  consoleStatus.style.color = isError ? '#dc2626' : '';
}

function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === ADMIN_SESSION_VALUE;
}

function setAdminAuthenticated(isAuthenticated) {
  if (isAuthenticated) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, ADMIN_SESSION_VALUE);
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

async function hashPassword(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}


function getStoredPortalConfig() {
  try {
    const raw = localStorage.getItem(PORTAL_LINKS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const branding = parsed.branding && typeof parsed.branding === 'object' ? parsed.branding : {};
    const roles = parsed.roles && typeof parsed.roles === 'object' ? parsed.roles : {};

    return { branding, roles };
  } catch (error) {
    console.warn('Unable to parse stored portal configuration.', error);
    return null;
  }
}


function loadCurrentPortalConfig() {
  const stored = getStoredPortalConfig();
  if (stored) {
    currentPortalConfig = deepClone(stored);
  } else {
    currentPortalConfig = deepClone(defaultPortalConfig || { branding: {}, roles: {} });
  }

  if (!currentPortalConfig || typeof currentPortalConfig !== 'object') {
    currentPortalConfig = { branding: {}, roles: {} };
  }

  const defaultBranding = defaultPortalConfig.branding && typeof defaultPortalConfig.branding === 'object'
    ? defaultPortalConfig.branding
    : {};

  if (!currentPortalConfig.branding || typeof currentPortalConfig.branding !== 'object') {
    currentPortalConfig.branding = {};
  }

  currentPortalConfig.branding = {
    ...defaultBranding,
    ...currentPortalConfig.branding
  };

  const defaultColors = defaultBranding.colors && typeof defaultBranding.colors === 'object' ? defaultBranding.colors : {};
  const currentColors = currentPortalConfig.branding.colors && typeof currentPortalConfig.branding.colors === 'object'
    ? currentPortalConfig.branding.colors
    : {};
  currentPortalConfig.branding.colors = normaliseColorMap({ ...defaultColors, ...currentColors });

  const defaultTransparency = normaliseTransparencyMap(
    defaultBranding.transparency && typeof defaultBranding.transparency === 'object'
      ? defaultBranding.transparency
      : {}
  );
  const currentTransparency =
    currentPortalConfig.branding.transparency && typeof currentPortalConfig.branding.transparency === 'object'
      ? currentPortalConfig.branding.transparency
      : {};
  currentPortalConfig.branding.transparency = {
    ...defaultTransparency,
    ...normaliseTransparencyMap(currentTransparency)
  };

  const defaultFooter = defaultBranding.footer && typeof defaultBranding.footer === 'object' ? defaultBranding.footer : {};
  const currentFooter = currentPortalConfig.branding.footer && typeof currentPortalConfig.branding.footer === 'object'
    ? currentPortalConfig.branding.footer
    : {};
  currentPortalConfig.branding.footer = { ...defaultFooter, ...currentFooter };

  if (!currentPortalConfig.roles || typeof currentPortalConfig.roles !== 'object') {
    currentPortalConfig.roles = {};
  }

  ROLE_ORDER.forEach((role) => {
    if (!Array.isArray(currentPortalConfig.roles[role])) {
      currentPortalConfig.roles[role] = [];
    }
  });
}

function persistPortalConfig() {
  const payload = {
    branding: currentPortalConfig.branding || {},
    roles: currentPortalConfig.roles || {}
  };
  if (!payload.branding || typeof payload.branding !== 'object') {
    payload.branding = {};
  }
  const colors =
    payload.branding.colors && typeof payload.branding.colors === 'object'
      ? payload.branding.colors
      : {};
  payload.branding.colors = normaliseColorMap(colors);

  const transparency =
    payload.branding.transparency && typeof payload.branding.transparency === 'object'
      ? payload.branding.transparency
      : {};
  payload.branding.transparency = normaliseTransparencyMap(transparency);
  localStorage.setItem(PORTAL_LINKS_STORAGE_KEY, JSON.stringify(payload));
}

function renderBranding() {
  if (!brandingContainer) {
    return;
  }

  const branding = currentPortalConfig.branding || {};

  brandingContainer.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'branding-card';

  const heading = document.createElement('h2');
  heading.textContent = 'Portal branding';
  section.appendChild(heading);

  const description = document.createElement('p');
  description.className = 'branding-description';
  description.textContent = 'Update the logo, messaging, and imagery that appear on the public landing page header.';
  section.appendChild(description);

  const form = document.createElement('form');
  form.className = 'admin-form branding-form';

  const defaultBrandingConfig =
    defaultPortalConfig.branding && typeof defaultPortalConfig.branding === 'object'
      ? defaultPortalConfig.branding
      : {};
  const defaultColorsRaw =
    defaultBrandingConfig.colors && typeof defaultBrandingConfig.colors === 'object'
      ? defaultBrandingConfig.colors
      : {};
  const defaultFooter =
    defaultBrandingConfig.footer && typeof defaultBrandingConfig.footer === 'object'
      ? defaultBrandingConfig.footer
      : {};
  const defaultColors = normaliseColorMap(defaultColorsRaw);
  const colors = normaliseColorMap(branding.colors && typeof branding.colors === 'object' ? branding.colors : {});
  currentPortalConfig.branding.colors = colors;
  const footer = branding.footer && typeof branding.footer === 'object' ? branding.footer : {};

  const defaultTransparencyRaw =
    defaultBrandingConfig.transparency && typeof defaultBrandingConfig.transparency === 'object'
      ? defaultBrandingConfig.transparency
      : {};
  const defaultTransparency = normaliseTransparencyMap(defaultTransparencyRaw);
  const transparency = normaliseTransparencyMap(
    branding.transparency && typeof branding.transparency === 'object' ? branding.transparency : {}
  );
  currentPortalConfig.branding.transparency = transparency;

  const defaultShowAccountDetails =
    typeof defaultBrandingConfig.showAccountDetails === 'boolean'
      ? defaultBrandingConfig.showAccountDetails
      : true;
  const showAccountDetailsSetting =
    typeof branding.showAccountDetails === 'boolean'
      ? branding.showAccountDetails
      : defaultShowAccountDetails;
  currentPortalConfig.branding.showAccountDetails = showAccountDetailsSetting;

  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.name = 'title';
  titleInput.placeholder = 'e.g. Riverdale Unified Portal';
  titleInput.value = branding.title || '';
  titleLabel.appendChild(titleInput);

  const taglineLabel = document.createElement('label');
  taglineLabel.textContent = 'Intro text';
  const taglineInput = document.createElement('textarea');
  taglineInput.name = 'tagline';
  taglineInput.rows = 2;
  taglineInput.placeholder = 'Short supporting sentence beneath the portal title.';
  taglineInput.value = branding.tagline || '';
  taglineLabel.appendChild(taglineInput);

  const accountToggleLabel = document.createElement('label');
  accountToggleLabel.className = 'toggle-field';
  const accountToggleInput = document.createElement('input');
  accountToggleInput.type = 'checkbox';
  accountToggleInput.name = 'showAccountDetails';
  accountToggleInput.value = '1';
  accountToggleInput.checked = showAccountDetailsSetting;
  const accountToggleText = document.createElement('span');
  accountToggleText.textContent = 'Show signed-in account details in the header';
  accountToggleLabel.appendChild(accountToggleInput);
  accountToggleLabel.appendChild(accountToggleText);

  const accountToggleHint = document.createElement('p');
  accountToggleHint.className = 'branding-hint';
  accountToggleHint.textContent =
    'Displays the signed-in user\'s name, email address, and mapped role beneath the intro text.';

  const logoLabel = document.createElement('label');
  logoLabel.textContent = 'Logo image URL';
  const logoInput = document.createElement('input');
  logoInput.type = 'url';
  logoInput.name = 'logo';
  logoInput.placeholder = 'https://cdn.example.com/crest.png';
  logoInput.value = branding.logo || '';
  logoLabel.appendChild(logoInput);

  const backgroundLabel = document.createElement('label');
  backgroundLabel.textContent = 'Header background image URL';
  const backgroundInput = document.createElement('input');
  backgroundInput.type = 'url';
  backgroundInput.name = 'backgroundImage';
  backgroundInput.placeholder = 'https://cdn.example.com/campus.jpg';
  backgroundInput.value = branding.backgroundImage || '';
  backgroundLabel.appendChild(backgroundInput);

  form.appendChild(titleLabel);
  form.appendChild(taglineLabel);
  form.appendChild(accountToggleLabel);
  form.appendChild(accountToggleHint);
  form.appendChild(logoLabel);
  form.appendChild(backgroundLabel);

  const pageBackgroundLabel = document.createElement('label');
  pageBackgroundLabel.textContent = 'Page background image URL';
  const pageBackgroundInput = document.createElement('input');
  pageBackgroundInput.type = 'url';
  pageBackgroundInput.name = 'pageBackgroundImage';
  pageBackgroundInput.placeholder = 'https://cdn.example.com/background.jpg';
  pageBackgroundInput.value = branding.pageBackgroundImage || '';
  pageBackgroundLabel.appendChild(pageBackgroundInput);

  form.appendChild(pageBackgroundLabel);

  const logoHint = document.createElement('p');
  logoHint.className = 'branding-hint';
  logoHint.textContent = 'Use transparent PNG/SVG logos and wide landscape photos (1200×400) for the best presentation.';
  form.appendChild(logoHint);

  const colourHeading = document.createElement('h3');
  colourHeading.className = 'branding-subheading';
  colourHeading.textContent = 'Portal colours';
  form.appendChild(colourHeading);

  const colourHint = document.createElement('p');
  colourHint.className = 'branding-hint';
  colourHint.textContent =
    'Accepts any CSS colour value (hex, rgb, hsl, etc.). Values are saved in hex format. Leave a field blank to use the default.';
  form.appendChild(colourHint);

  const colourGrid = document.createElement('div');
  colourGrid.className = 'color-grid';

  COLOR_FIELDS.forEach((field) => {
    const colorLabel = document.createElement('label');
    colorLabel.textContent = field.label;
    const colorInput = document.createElement('input');
    colorInput.type = 'text';
    colorInput.name = `color-${field.key}`;
    colorInput.value = colors[field.key] || '';
    const defaultValue = defaultColors[field.key] || normaliseColorValue(field.placeholder || '');
    if (defaultValue) {
      colorInput.placeholder = defaultValue;
    } else if (field.placeholder) {
      colorInput.placeholder = field.placeholder;
    }
    colorInput.autocomplete = 'off';
    colorInput.spellcheck = false;
    colorInput.dataset.fieldLabel = field.label;
    initialiseColorInput(colorInput, defaultValue || '');
    colorLabel.appendChild(colorInput);
    colourGrid.appendChild(colorLabel);
  });

  form.appendChild(colourGrid);

  TRANSPARENCY_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(currentPortalConfig.branding.transparency, field.key)) {
      const fallbackValue = Object.prototype.hasOwnProperty.call(defaultTransparency, field.key)
        ? defaultTransparency[field.key]
        : field.default;
      const normalisedFallback = Math.min(1, Math.max(0, typeof fallbackValue === 'number' ? fallbackValue : 0));
      currentPortalConfig.branding.transparency[field.key] = Number(normalisedFallback.toFixed(3));
    }
  });

  const transparencyHeading = document.createElement('h3');
  transparencyHeading.className = 'branding-subheading';
  transparencyHeading.textContent = 'Glass opacity';
  form.appendChild(transparencyHeading);

  const transparencyHint = document.createElement('p');
  transparencyHint.className = 'branding-hint';
  transparencyHint.textContent = 'Control how transparent the header, link grid, footer, and buttons appear.';
  form.appendChild(transparencyHint);

  const transparencyGrid = document.createElement('div');
  transparencyGrid.className = 'transparency-grid';

  TRANSPARENCY_FIELDS.forEach((field) => {
    const label = document.createElement('label');
    label.className = 'transparency-control';

    const labelText = document.createElement('span');
    labelText.textContent = field.label;
    label.appendChild(labelText);

    const sliderRow = document.createElement('div');
    sliderRow.className = 'transparency-control__row';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.name = `transparency-${field.key}`;
    slider.className = 'transparency-control__slider';

    const defaultValue = Object.prototype.hasOwnProperty.call(defaultTransparency, field.key)
      ? defaultTransparency[field.key]
      : field.default;
    const effectiveValue = Object.prototype.hasOwnProperty.call(transparency, field.key)
      ? transparency[field.key]
      : defaultValue;
    const normalisedValue = Math.min(
      1,
      Math.max(0, typeof effectiveValue === 'number' ? effectiveValue : typeof defaultValue === 'number' ? defaultValue : 0)
    );
    const sliderValue = Math.round(normalisedValue * 100);

    slider.value = String(sliderValue);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'transparency-control__value';
    valueDisplay.textContent = `${sliderValue}% opacity`;

    slider.addEventListener('input', () => {
      const currentValue = Number(slider.value);
      const safeValue = Number.isNaN(currentValue) ? 0 : Math.min(100, Math.max(0, currentValue));
      valueDisplay.textContent = `${safeValue}% opacity`;

      if (!currentPortalConfig.branding || typeof currentPortalConfig.branding !== 'object') {
        return;
      }
      if (!currentPortalConfig.branding.transparency || typeof currentPortalConfig.branding.transparency !== 'object') {
        currentPortalConfig.branding.transparency = {};
      }

      currentPortalConfig.branding.transparency[field.key] = Number((safeValue / 100).toFixed(3));
      applyTransparencyVariablesToDocument(
        currentPortalConfig.branding.colors || {},
        currentPortalConfig.branding.transparency
      );
    });

    sliderRow.appendChild(slider);
    sliderRow.appendChild(valueDisplay);
    label.appendChild(sliderRow);
    transparencyGrid.appendChild(label);
  });

  form.appendChild(transparencyGrid);

  const footerHeading = document.createElement('h3');
  footerHeading.className = 'branding-subheading';
  footerHeading.textContent = 'Portal footer';
  form.appendChild(footerHeading);

  const footerHint = document.createElement('p');
  footerHint.className = 'branding-hint';
  footerHint.textContent = 'Add optional HTML below the link grid and customise the privacy policy link.';
  form.appendChild(footerHint);

  const footerHtmlLabel = document.createElement('label');
  footerHtmlLabel.textContent = 'Custom HTML beneath portal links';
  const footerHtmlInput = document.createElement('textarea');
  footerHtmlInput.name = 'footerHtml';
  footerHtmlInput.rows = 4;
  footerHtmlInput.placeholder = '<p>Helpful contact details or announcements.</p>';
  footerHtmlInput.value = footer.customHtml || '';
  footerHtmlLabel.appendChild(footerHtmlInput);

  const privacyLabel = document.createElement('label');
  privacyLabel.textContent = 'Privacy policy link text';
  const privacyInput = document.createElement('input');
  privacyInput.type = 'text';
  privacyInput.name = 'footerPrivacyLabel';
  privacyInput.placeholder = defaultFooter.privacyPolicyLabel || 'Privacy policy';
  privacyInput.value = footer.privacyPolicyLabel || '';
  privacyLabel.appendChild(privacyInput);

  const privacyUrlLabel = document.createElement('label');
  privacyUrlLabel.textContent = 'Privacy policy URL';
  const privacyUrlInput = document.createElement('input');
  privacyUrlInput.type = 'url';
  privacyUrlInput.name = 'footerPrivacyUrl';
  privacyUrlInput.placeholder = defaultFooter.privacyPolicyUrl || 'https://example.com/privacy';
  privacyUrlInput.value = footer.privacyPolicyUrl || '';
  privacyUrlLabel.appendChild(privacyUrlInput);

  form.appendChild(footerHtmlLabel);
  form.appendChild(privacyLabel);
  form.appendChild(privacyUrlLabel);

  const actions = document.createElement('div');
  actions.className = 'admin-actions';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'primary-button';
  submitButton.textContent = 'Save branding';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'tertiary-button';
  resetButton.textContent = 'Use default branding';
  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm('Restore all branding settings to their defaults?');
    if (!confirmed) {
      return;
    }

    currentPortalConfig.branding = deepClone(defaultPortalConfig.branding || {});
    if (
      !currentPortalConfig.branding.colors ||
      typeof currentPortalConfig.branding.colors !== 'object'
    ) {
      currentPortalConfig.branding.colors = {};
    }
    currentPortalConfig.branding.colors = normaliseColorMap(currentPortalConfig.branding.colors);
    if (
      !currentPortalConfig.branding.transparency ||
      typeof currentPortalConfig.branding.transparency !== 'object'
    ) {
      currentPortalConfig.branding.transparency = {};
    }
    currentPortalConfig.branding.transparency = normaliseTransparencyMap(
      currentPortalConfig.branding.transparency
    );
    persistPortalConfig();
    renderBranding();
    showConsoleMessage('Branding restored to default values.');
  });

  actions.appendChild(submitButton);
  actions.appendChild(resetButton);

  form.appendChild(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleBrandingSubmit(form);
  });

  section.appendChild(form);
  brandingContainer.appendChild(section);
  refreshAdminPreview();
}

function handleBrandingSubmit(form) {
  const formData = new FormData(form);
  const title = (formData.get('title') || '').toString().trim();
  const taglineValue = formData.get('tagline');
  const tagline = typeof taglineValue === 'string' ? taglineValue.trim() : '';
  const logo = (formData.get('logo') || '').toString().trim();
  const backgroundImage = (formData.get('backgroundImage') || '').toString().trim();
  const pageBackgroundImage = (formData.get('pageBackgroundImage') || '').toString().trim();
  const showAccountDetails = formData.has('showAccountDetails');

  const colorOverrides = {};
  for (const field of COLOR_FIELDS) {
    const input = form.querySelector(`input[name="color-${field.key}"]`);
    const rawValue = formData.get(`color-${field.key}`);
    if (typeof rawValue !== 'string') {
      continue;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      colorOverrides[field.key] = '';
      if (input) {
        input.value = '';
        input.dataset.lastPreviewColor = 'transparent';
        setColorInputPreview(input, 'transparent');
        input.classList.remove('color-input--invalid');
      }
      continue;
    }

    const normalised = normaliseColorValue(trimmed);
    if (!normalised) {
      if (input) {
        updateColorInputPreviewFromState(input, true);
        input.focus();
      }
      showConsoleMessage(`"${field.label}" must be blank or a valid CSS colour.`, true);
      return;
    }

    colorOverrides[field.key] = normalised;
    if (input && normalised !== trimmed) {
      input.value = normalised;
      updateColorInputPreviewFromState(input, false);
    }
  }

  const defaultBrandingConfig =
    defaultPortalConfig.branding && typeof defaultPortalConfig.branding === 'object'
      ? defaultPortalConfig.branding
      : {};
  const defaultColors =
    defaultBrandingConfig.colors && typeof defaultBrandingConfig.colors === 'object'
      ? normaliseColorMap(defaultBrandingConfig.colors)
      : {};
  const mergedColors = normaliseColorMap({
    ...defaultColors,
    ...colorOverrides
  });

  const defaultTransparency = normaliseTransparencyMap(
    defaultBrandingConfig.transparency && typeof defaultBrandingConfig.transparency === 'object'
      ? defaultBrandingConfig.transparency
      : {}
  );

  const transparencyConfig = { ...defaultTransparency };
  for (const field of TRANSPARENCY_FIELDS) {
    const rawSlider = formData.get(`transparency-${field.key}`);
    if (typeof rawSlider !== 'string') {
      continue;
    }

    const numericValue = Number(rawSlider);
    if (Number.isNaN(numericValue)) {
      continue;
    }

    const clamped = Math.min(100, Math.max(0, numericValue));
    transparencyConfig[field.key] = Number((clamped / 100).toFixed(3));
  }

  const footerDefaults =
    defaultBrandingConfig.footer && typeof defaultBrandingConfig.footer === 'object'
      ? defaultBrandingConfig.footer
      : {};
  const footerHtmlValue = formData.get('footerHtml');
  const customHtml = typeof footerHtmlValue === 'string' ? footerHtmlValue : '';
  const privacyLabelValue = formData.get('footerPrivacyLabel');
  const privacyPolicyLabel = typeof privacyLabelValue === 'string' ? privacyLabelValue.trim() : '';
  const privacyUrlValue = formData.get('footerPrivacyUrl');
  const privacyPolicyUrl = typeof privacyUrlValue === 'string' ? privacyUrlValue.trim() : '';

  const footerConfig = {
    ...footerDefaults,
    customHtml,
    privacyPolicyLabel: privacyPolicyLabel || footerDefaults.privacyPolicyLabel || 'Privacy policy',
    privacyPolicyUrl: privacyPolicyUrl || footerDefaults.privacyPolicyUrl || '#'
  };

  currentPortalConfig.branding = {
    ...currentPortalConfig.branding,
    title,
    tagline,
    logo,
    backgroundImage,
    pageBackgroundImage,
    showAccountDetails,
    colors: mergedColors,
    footer: footerConfig,
    transparency: transparencyConfig
  };

  persistPortalConfig();
  renderBranding();
  showConsoleMessage('Branding updated successfully.');
}

function createLinkListItem(roleKey, link, index) {
  const item = document.createElement('li');

  const info = document.createElement('div');
  info.className = 'link-info';
  const title = document.createElement('span');
  title.textContent = link.title;
  const url = document.createElement('span');
  url.textContent = link.url;
  const target = document.createElement('span');
  target.textContent = link.target === '_self' ? 'Opens in same window' : 'Opens in new window';

  info.appendChild(title);
  info.appendChild(url);
  info.appendChild(target);

  const actions = document.createElement('div');
  actions.className = 'link-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'tertiary-button';
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => startEditLink(roleKey, index));

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'tertiary-button danger';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => deleteLink(roleKey, index));

  actions.appendChild(editButton);
  actions.appendChild(deleteButton);

  item.appendChild(info);
  item.appendChild(actions);

  return item;
}

function buildRoleSection(roleKey) {
  const section = document.createElement('section');
  section.className = 'role-section';
  section.dataset.role = roleKey;

  const heading = document.createElement('h2');
  heading.textContent = ROLE_LABELS[roleKey] || roleKey;
  section.appendChild(heading);

  const description = document.createElement('p');
  description.textContent = 'Configure the shortcuts that appear on the portal for this role.';
  section.appendChild(description);

  const list = document.createElement('ul');
  list.className = 'link-list';

  const links = currentPortalConfig.roles[roleKey] || [];
  if (links.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No links have been configured yet.';
    empty.style.fontStyle = 'italic';
    empty.style.color = '#6b7280';
    list.appendChild(empty);
  } else {
    links.forEach((link, index) => {
      list.appendChild(createLinkListItem(roleKey, link, index));
    });
  }

  section.appendChild(list);

  const form = document.createElement('form');
  form.className = 'admin-form';
  form.dataset.role = roleKey;

  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.name = 'title';
  titleInput.required = true;
  titleInput.placeholder = 'e.g. Grades & Attendance';
  titleLabel.appendChild(titleInput);

  const urlLabel = document.createElement('label');
  urlLabel.textContent = 'URL';
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.name = 'url';
  urlInput.required = true;
  urlInput.placeholder = 'https://example.com/path';
  urlLabel.appendChild(urlInput);

  const iconLabel = document.createElement('label');
  iconLabel.textContent = 'Icon or image URL';
  const iconInput = document.createElement('input');
  iconInput.type = 'url';
  iconInput.name = 'icon';
  iconInput.placeholder = 'Start typing to choose an icon or paste an image URL';
  iconInput.autocomplete = 'off';
  attachIconPicker(iconInput);
  iconLabel.appendChild(iconInput);

  const targetLabel = document.createElement('label');
  targetLabel.textContent = 'Open link in';
  const targetSelect = document.createElement('select');
  targetSelect.name = 'target';
  const optionBlank = document.createElement('option');
  optionBlank.value = '_blank';
  optionBlank.textContent = 'New window/tab';
  const optionSelf = document.createElement('option');
  optionSelf.value = '_self';
  optionSelf.textContent = 'Same window';
  targetSelect.appendChild(optionBlank);
  targetSelect.appendChild(optionSelf);
  targetLabel.appendChild(targetSelect);

  form.appendChild(titleLabel);
  form.appendChild(urlLabel);
  form.appendChild(iconLabel);
  form.appendChild(targetLabel);

  const actionRow = document.createElement('div');
  actionRow.className = 'admin-actions';

  const hiddenIndex = document.createElement('input');
  hiddenIndex.type = 'hidden';
  hiddenIndex.name = 'index';
  hiddenIndex.value = '';
  form.appendChild(hiddenIndex);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'primary-button';
  submitButton.textContent = 'Add link';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'tertiary-button';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', () => resetForm(form));

  actionRow.appendChild(submitButton);
  actionRow.appendChild(cancelButton);

  form.appendChild(actionRow);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleFormSubmit(form);
  });

  section.appendChild(form);

  return section;
}

function renderRoles() {
  if (!rolesContainer) {
    return;
  }

  rolesContainer.innerHTML = '';
  ROLE_ORDER.forEach((roleKey) => {
    const section = buildRoleSection(roleKey);
    rolesContainer.appendChild(section);
  });
}

function resetForm(form) {
  form.reset();
  form.querySelector('input[name="index"]').value = '';
  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.textContent = 'Add link';
  }
  showConsoleMessage('');
}

function handleFormSubmit(form) {
  const roleKey = form.dataset.role;
  if (!roleKey) {
    showConsoleMessage('Unable to determine role for the submitted form.', true);
    return;
  }

  const title = form.querySelector('input[name="title"]').value.trim();
  const url = form.querySelector('input[name="url"]').value.trim();
  const icon = form.querySelector('input[name="icon"]').value.trim();
  const target = form.querySelector('select[name="target"]').value || '_blank';
  const indexValue = form.querySelector('input[name="index"]').value;

  if (!title || !url) {
    showConsoleMessage('Title and URL are required fields.', true);
    return;
  }

  const linkData = { title, url, icon, target };
  const index = indexValue === '' ? -1 : Number(indexValue);

  if (index >= 0 && Number.isInteger(index)) {
    currentPortalConfig.roles[roleKey][index] = linkData;
    showConsoleMessage('Link updated successfully.');
  } else {
    currentPortalConfig.roles[roleKey].push(linkData);
    showConsoleMessage('Link added successfully.');
  }

  persistPortalConfig();
  renderRoles();
}

function startEditLink(roleKey, index) {
  const section = rolesContainer.querySelector(`.role-section[data-role="${roleKey}"]`);
  if (!section) {
    return;
  }

  const form = section.querySelector('form');
  const link = currentPortalConfig.roles[roleKey][index];
  if (!form || !link) {
    return;
  }

  form.querySelector('input[name="title"]').value = link.title || '';
  form.querySelector('input[name="url"]').value = link.url || '';
  form.querySelector('input[name="icon"]').value = link.icon || '';
  form.querySelector('select[name="target"]').value = link.target === '_self' ? '_self' : '_blank';
  form.querySelector('input[name="index"]').value = String(index);

  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.textContent = 'Update link';
  }

  showConsoleMessage(`Editing link #${index + 1} for ${ROLE_LABELS[roleKey] || roleKey}.`);
}

function deleteLink(roleKey, index) {
  const link = currentPortalConfig.roles[roleKey][index];
  if (!link) {
    return;
  }

  const confirmed = window.confirm(`Remove "${link.title}" from the ${ROLE_LABELS[roleKey] || roleKey} portal?`);
  if (!confirmed) {
    return;
  }

  currentPortalConfig.roles[roleKey].splice(index, 1);
  persistPortalConfig();
  renderRoles();
  showConsoleMessage('Link removed.');
}

async function handleLogin(event) {
  event.preventDefault();
  if (!loginForm) {
    return;
  }

  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;

  if (!username || !password) {
    showLoginMessage('Enter both username and password.', true);
    return;
  }

  try {
    const passwordHash = await hashPassword(password);
    if (username === adminCredentials.username && passwordHash === adminCredentials.passwordHash) {
      setAdminAuthenticated(true);
      showLoginMessage('');
      enterConsole();
      loginForm.reset();
    } else {
      showLoginMessage('Invalid credentials. Please try again.', true);
    }
  } catch (error) {
    console.error('Unable to validate administrator credentials.', error);
    showLoginMessage('An error occurred while validating your credentials.', true);
  }
}

function enterConsole() {
  loadCurrentPortalConfig();
  renderBranding();
  renderRoles();
  showConsoleMessage('Signed in as portal administrator.');

  if (loginSection) {
    loginSection.classList.add('hidden');
  }
  if (consoleSection) {
    consoleSection.classList.remove('hidden');
  }
}

function leaveConsole() {
  setAdminAuthenticated(false);
  if (consoleSection) {
    consoleSection.classList.add('hidden');
  }
  if (loginSection) {
    loginSection.classList.remove('hidden');
  }
  showConsoleMessage('');
  showLoginMessage('Signed out successfully.');
}

async function initializeAdmin() {
  try {
    await loadConfiguration();
  } catch (error) {
    console.error(error);
    showLoginMessage('Unable to load configuration. Check the console for details.', true);
    return;
  }

  loadCurrentPortalConfig();
  refreshAdminPreview();

  if (isAdminAuthenticated()) {
    enterConsole();
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    leaveConsole();
  });
}

window.addEventListener('storage', (event) => {
  if (event.key === PORTAL_LINKS_STORAGE_KEY && isAdminAuthenticated()) {
    loadCurrentPortalConfig();
    renderBranding();
    renderRoles();
    showConsoleMessage('Portal settings updated in another tab. Display refreshed.');
  }
});

initializeAdmin();
