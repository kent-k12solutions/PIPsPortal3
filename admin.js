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
      if (!trimmed || !isValidCssColor(trimmed)) {
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
        if (normalisedValue) {
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

    return {
      normaliseColorValue,
      normaliseColorMap,
      resolveColorToRgbComponents,
      parseHexColor,
      getReadableTextColor
    };
  })());

const { normaliseColorValue, normaliseColorMap, parseHexColor, getReadableTextColor } = PortalColorUtils;

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
  { key: 'sessionButtonBackground', label: 'Session button background', placeholder: '#ffffffd9' },
  { key: 'emptyStateBackground', label: 'Empty state background', placeholder: '#6b72801f' },
  { key: 'tertiaryButtonBackground', label: 'Secondary surface colour', placeholder: '#ffffff' },
  { key: 'danger', label: 'Danger colour', placeholder: '#dc2626' },
  { key: 'footerBackground', label: 'Footer background colour', placeholder: '#ffffff' },
  { key: 'footerText', label: 'Footer text colour', placeholder: '#6b7280' },
  { key: 'footerLink', label: 'Footer link colour', placeholder: '#1d4ed8' }
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

  const raw = input.value.trim();
  if (!raw) {
    input.classList.remove('color-input--invalid');
    const fallback = input.dataset.defaultColor || '';
    setColorInputPreview(input, fallback);
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

let adminCredentials = { username: '', passwordHash: '' };
let defaultPortalConfig = { branding: {}, roles: {} };
let currentPortalConfig = { branding: {}, roles: {} };

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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
      continue;
    }

    const normalised = normaliseColorValue(trimmed);
    if (!normalised) {
      if (input) {
        updateColorInputPreviewFromState(input, true);
        input.focus();
      }
      showConsoleMessage(`"${field.label}" must be a valid CSS colour in #rrggbb format.`, true);
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
    footer: footerConfig
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
