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

const { normaliseColorValue, normaliseColorMap, resolveColorToRgbComponents } = PortalColorUtils;

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

const siteHeaderElement = document.getElementById('site-header');
const brandLogoWrapper = document.getElementById('brand-logo');
const portalLogoElement = document.getElementById('portal-logo');
const portalTitleElement = document.getElementById('portal-title');
const portalTaglineElement = document.getElementById('portal-tagline');
const statusElement = document.getElementById('status');
const loginButton = document.getElementById('login-btn');
const accountNameElement = document.getElementById('account-name');
const accountEmailElement = document.getElementById('account-email');
const accountRoleElement = document.getElementById('account-role');
const accountSection = document.getElementById('account-section');
const logoutButton = document.getElementById('logout-btn');
const portalHeadingElement = document.getElementById('portal-heading');
const portalDescriptionElement = document.getElementById('portal-description');
const linksContainer = document.getElementById('links-container');
const emptyStateElement = document.getElementById('links-empty');
const portalCustomFooter = document.getElementById('portal-custom-footer');
const privacyPolicyLinkElement = document.getElementById('privacy-policy-link');
const portalCopyrightElement = document.getElementById('portal-copyright');

const initialPortalTitle = portalTitleElement ? portalTitleElement.textContent : 'PIPS Unified Portal';
const initialPortalTagline = portalTaglineElement
  ? portalTaglineElement.textContent
  : 'Sign in with your ParentIDPassport credentials to unlock experiences tailored to your role.';

const PORTAL_LINKS_STORAGE_KEY = 'portalLinksConfig';
const ROLE_LABELS = {
  anonymous: 'Guests',
  parents: 'Parents & Guardians',
  students: 'Students',
  staff: 'Staff'
};
const ROLE_SYNONYMS = {
  anonymous: ['anonymous', 'guest', 'public'],
  parents: ['parent', 'parents', 'guardian', 'guardians', 'family'],
  students: ['student', 'students', 'learner', 'learners'],
  staff: ['staff', 'teacher', 'teachers', 'faculty', 'employee', 'employees']
};

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

let msalInstance;
let loginRequest = {};
let defaultPortalConfig = { branding: {}, roles: {} };
let accountDetailsEnabled = true;

function applyColorVariables(colors = {}) {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const normalisedColors = normaliseColorMap(colors);

  Object.entries(COLOR_VARIABLE_MAP).forEach(([key, variable]) => {
    const value = normalisedColors[key];
    if (value) {
      root.style.setProperty(variable, value);
    } else {
      root.style.removeProperty(variable);
    }
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

function applyFooterSettings(footerConfig = {}) {
  if (portalCustomFooter) {
    const rawHtml = typeof footerConfig.customHtml === 'string' ? footerConfig.customHtml : '';
    if (rawHtml.trim()) {
      portalCustomFooter.innerHTML = rawHtml;
      portalCustomFooter.classList.remove('hidden');
    } else {
      portalCustomFooter.innerHTML = '';
      portalCustomFooter.classList.add('hidden');
    }
  }

  if (privacyPolicyLinkElement) {
    const label = typeof footerConfig.privacyPolicyLabel === 'string' ? footerConfig.privacyPolicyLabel.trim() : '';
    const url = typeof footerConfig.privacyPolicyUrl === 'string' ? footerConfig.privacyPolicyUrl.trim() : '';

    const linkText = label || 'Privacy policy';
    privacyPolicyLinkElement.textContent = linkText;

    if (url) {
      privacyPolicyLinkElement.href = url;
      privacyPolicyLinkElement.classList.remove('hidden');
      privacyPolicyLinkElement.setAttribute('target', '_blank');
      privacyPolicyLinkElement.setAttribute('rel', 'noopener noreferrer');
    } else {
      privacyPolicyLinkElement.href = '#';
      privacyPolicyLinkElement.classList.add('hidden');
      privacyPolicyLinkElement.removeAttribute('target');
      privacyPolicyLinkElement.removeAttribute('rel');
    }
  }
}

function updateCopyright(title) {
  if (!portalCopyrightElement) {
    return;
  }

  const year = new Date().getFullYear();
  const safeTitle = (title && title.trim()) || initialPortalTitle || 'PIPs Portal';
  portalCopyrightElement.textContent = `© ${year} ${safeTitle}`;
}

function setStatus(message) {
  if (!statusElement) {
    return;
  }

  const text = typeof message === 'string' ? message : '';
  statusElement.textContent = text;

  if (text.trim()) {
    statusElement.classList.remove('hidden');
  } else {
    statusElement.classList.add('hidden');
  }
}

function getRolesFromClaims(claims) {
  if (!claims) {
    return [];
  }

  const claimKeys = Object.keys(claims);
  const candidateKeys = ['roles', 'role', 'extension_roles', 'extension_role'];

  for (const candidate of candidateKeys) {
    const match = claimKeys.find((key) => key.toLowerCase() === candidate);
    if (!match) {
      continue;
    }

    const value = claims[match];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }

    if (typeof value === 'string' && value) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);

    }
  }

  return [];
}

function formatRoles(claims) {
  const roles = getRolesFromClaims(claims);
  return roles.length > 0 ? roles.join(', ') : '';
}

function normalizeRoleValue(value) {
  return value.trim().toLowerCase();
}

function findPortalRoleMatch(claims) {
  const roles = getRolesFromClaims(claims).map((role) => normalizeRoleValue(role));
  if (roles.length === 0) {
    return null;
  }

  for (const [portalRole, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    if (roles.some((role) => synonyms.includes(role))) {
      return portalRole;
    }
  }

  return null;
}

function determinePortalRole(account) {
  if (!account) {
    return 'anonymous';
  }

  const claims = account.idTokenClaims || {};
  const directMatch = findPortalRoleMatch(claims);
  if (directMatch) {
    return directMatch;
  }

  // Default to anonymous when we cannot confidently map the claim.
  return 'anonymous';
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
    if (!branding.colors || typeof branding.colors !== 'object') {
      branding.colors = {};
    }
    branding.colors = normaliseColorMap(branding.colors);
    const roles = parsed.roles && typeof parsed.roles === 'object' ? parsed.roles : {};

    return { branding, roles };
  } catch (error) {
    console.warn('Unable to read portal links from local storage.', error);
    return null;
  }
}

function getPortalLinksForRole(roleKey) {
  const stored = getStoredPortalConfig();
  if (stored && stored.roles && Array.isArray(stored.roles[roleKey])) {
    return stored.roles[roleKey];
  }

  if (defaultPortalConfig.roles && Array.isArray(defaultPortalConfig.roles[roleKey])) {
    return defaultPortalConfig.roles[roleKey];
  }

  return [];
}

function getPortalBranding() {
  const stored = getStoredPortalConfig();
  const defaultBranding = defaultPortalConfig.branding && typeof defaultPortalConfig.branding === 'object'
    ? defaultPortalConfig.branding
    : {};
  const storedBranding = stored && stored.branding && typeof stored.branding === 'object' ? stored.branding : {};

  const defaultColors = normaliseColorMap(
    defaultBranding.colors && typeof defaultBranding.colors === 'object' ? defaultBranding.colors : {}
  );
  const storedColors = normaliseColorMap(
    storedBranding.colors && typeof storedBranding.colors === 'object' ? storedBranding.colors : {}
  );

  const defaultFooter = defaultBranding.footer && typeof defaultBranding.footer === 'object' ? defaultBranding.footer : {};
  const storedFooter = storedBranding.footer && typeof storedBranding.footer === 'object' ? storedBranding.footer : {};

  const defaultShowAccountDetails =
    typeof defaultBranding.showAccountDetails === 'boolean' ? defaultBranding.showAccountDetails : true;
  const storedShowAccountDetails =
    typeof storedBranding.showAccountDetails === 'boolean' ? storedBranding.showAccountDetails : undefined;

  return {
    ...defaultBranding,
    ...storedBranding,
    colors: normaliseColorMap({ ...defaultColors, ...storedColors }),
    footer: { ...defaultFooter, ...storedFooter },
    showAccountDetails:
      typeof storedShowAccountDetails === 'boolean' ? storedShowAccountDetails : defaultShowAccountDetails
  };
}

function applyBranding() {
  const branding = getPortalBranding();
  const stored = getStoredPortalConfig();
  const storedBranding = stored && stored.branding && typeof stored.branding === 'object' ? stored.branding : {};

  const normalisedColors = normaliseColorMap(branding.colors || {});
  branding.colors = normalisedColors;
  applyColorVariables(normalisedColors);

  const showAccountPreference =
    typeof branding.showAccountDetails === 'boolean'
      ? branding.showAccountDetails
      : typeof (defaultPortalConfig.branding || {}).showAccountDetails === 'boolean'
        ? defaultPortalConfig.branding.showAccountDetails
        : true;
  accountDetailsEnabled = showAccountPreference;
  if (!accountDetailsEnabled && accountSection) {
    accountSection.classList.add('hidden');
  }

  const pageBackgroundUrl =
    typeof branding.pageBackgroundImage === 'string' ? branding.pageBackgroundImage.trim() : '';
  const root = document.documentElement;
  if (root) {
    if (pageBackgroundUrl) {
      const cssUrl = `url(${JSON.stringify(pageBackgroundUrl)})`;
      root.style.setProperty('--page-background-image', cssUrl);
    } else {
      root.style.setProperty('--page-background-image', 'none');
    }
  }

  if (portalTitleElement) {
    const title = branding.title || initialPortalTitle;
    portalTitleElement.textContent = title;
    updateCopyright(title);
  } else {
    updateCopyright(branding.title || initialPortalTitle);
  }

  if (portalTaglineElement) {
    const taglineOverrideExists = Object.prototype.hasOwnProperty.call(storedBranding, 'tagline');
    const taglineSource = taglineOverrideExists ? storedBranding.tagline : branding.tagline;
    const normalizedTagline = typeof taglineSource === 'string' ? taglineSource.trim() : '';

    if (taglineOverrideExists && !normalizedTagline) {
      portalTaglineElement.textContent = '';
      portalTaglineElement.classList.add('hidden');
    } else if (normalizedTagline) {
      portalTaglineElement.textContent = normalizedTagline;
      portalTaglineElement.classList.remove('hidden');
    } else if (initialPortalTagline) {
      portalTaglineElement.textContent = initialPortalTagline;
      portalTaglineElement.classList.remove('hidden');
    } else {
      portalTaglineElement.textContent = '';
      portalTaglineElement.classList.add('hidden');
    }
  }

  if (portalLogoElement) {
    if (branding.logo) {
      portalLogoElement.src = branding.logo;
      portalLogoElement.classList.remove('hidden');
      if (brandLogoWrapper) {
        brandLogoWrapper.classList.remove('hidden');
      }
    } else {
      portalLogoElement.removeAttribute('src');
      portalLogoElement.classList.add('hidden');
      if (brandLogoWrapper) {
        brandLogoWrapper.classList.add('hidden');
      }
    }
  }

  if (siteHeaderElement) {
    if (branding.backgroundImage) {
      siteHeaderElement.style.setProperty('--header-background-image', `url(${branding.backgroundImage})`);
    } else {
      siteHeaderElement.style.removeProperty('--header-background-image');
    }
  }

  applyFooterSettings(branding.footer || {});
}

function renderPortal(roleKey) {
  if (!linksContainer || !portalHeadingElement || !portalDescriptionElement || !emptyStateElement) {
    return;
  }

  const label = ROLE_LABELS[roleKey] || 'your role';
  portalHeadingElement.textContent = `Resources for ${label}`;
  portalDescriptionElement.textContent =
    roleKey === 'anonymous'
      ? 'Sign in to access additional personalized tools and experiences.'
      : 'Choose a tile below to launch the resources curated for your role.';

  linksContainer.innerHTML = '';
  const links = getPortalLinksForRole(roleKey);

  if (links.length === 0) {
    emptyStateElement.classList.remove('hidden');
    return;
  }

  emptyStateElement.classList.add('hidden');

  links.forEach((link) => {
    if (!link || !link.title || !link.url) {
      return;
    }

    const card = document.createElement('a');
    card.className = 'link-card';
    card.href = link.url;
    card.target = link.target === '_self' ? '_self' : '_blank';
    card.rel = card.target === '_blank' ? 'noopener noreferrer' : '';
    card.role = 'listitem';

    if (link.icon) {
      const icon = document.createElement('img');
      icon.src = link.icon;
      icon.alt = `${link.title} icon`;
      icon.loading = 'lazy';
      card.appendChild(icon);
    }

    const title = document.createElement('h3');
    title.textContent = link.title;
    card.appendChild(title);

    linksContainer.appendChild(card);
  });
}


function showAccountInfo(account) {
  if (accountDetailsEnabled && account && accountSection && accountNameElement && accountEmailElement && accountRoleElement) {
    const claims = account.idTokenClaims || {};
    const displayName = account.name || claims.name || account.username || 'Signed in';
    const emailClaim = Array.isArray(claims.emails)
      ? claims.emails[0]
      : claims.email || account.username || '';
    const rolesDisplay = formatRoles(claims);

    accountNameElement.textContent = `Name: ${displayName}`;
    accountEmailElement.textContent = emailClaim ? `Email: ${emailClaim}` : 'Email: Not available';
    accountRoleElement.textContent = rolesDisplay ? `Role: ${rolesDisplay}` : 'Role: Not assigned';

    accountSection.classList.remove('hidden');

  } else {
    if (accountNameElement) {
      accountNameElement.textContent = '';
    }
    if (accountEmailElement) {
      accountEmailElement.textContent = '';
    }
    if (accountRoleElement) {
      accountRoleElement.textContent = '';
    }
    if (accountSection) {
      accountSection.classList.add('hidden');
    }
  }

  if (account) {
    if (loginButton) {
      loginButton.classList.add('hidden');
    }
    if (logoutButton) {
      logoutButton.classList.remove('hidden');
    }
    logoutButton.disabled = false;
  } else {
    if (loginButton) {
      loginButton.classList.remove('hidden');
    }
    if (logoutButton) {
      logoutButton.classList.add('hidden');
    }

    logoutButton.disabled = false;
  }

  const roleKey = determinePortalRole(account);
  renderPortal(roleKey);
}

function getFriendlyErrorMessage(error) {
  if (!error) {
    return 'Unable to complete sign-in. Check the console for details.';
  }

  const message = error.errorMessage || error.message || '';
  if (message.includes('AADB2C90079')) {
    return (
      'The B2C application is configured as a confidential client and requires a client secret. ' +
      'Single-page applications cannot supply secrets directly. Update the app registration to be a SPA/public client, ' +
      'or move the token redemption to a confidential back-end.'
    );
  }

  if (message.includes('AADB2C90068')) {
    return (
      'The application ID configured for this policy is not recognized by Azure AD B2C. ' +
      'Confirm that the user flow or custom policy references an app registration created in the B2C portal, ' +
      "and update config.json to use that application's client ID."
    );
  }

  return 'Unable to complete sign-in. Check the console for details.';
}

function initializeMsal(config) {
  loginRequest = { scopes: config.scopes || [] };

  msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      knownAuthorities: config.knownAuthorities,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.postLogoutRedirectUri || config.redirectUri
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false
    }
  });

  msalInstance
    .handleRedirectPromise()
    .then((response) => {
      if (response && response.account) {
        msalInstance.setActiveAccount(response.account);
      }

      const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
      if (account) {
        msalInstance.setActiveAccount(account);
        setStatus('');
      } else {
        setStatus('You are not signed in.');
      }

      showAccountInfo(account);
      loginButton.disabled = false;
    })
    .catch((error) => {
      console.error('Authentication error', error);
      setStatus(getFriendlyErrorMessage(error));
      loginButton.disabled = false;
      showAccountInfo(null);
    });
}

if (loginButton) {
  loginButton.addEventListener('click', () => {
    if (!msalInstance) {
      console.error('MSAL is not initialized yet.');
      return;
    }

    setStatus('Redirecting to sign-in…');
    msalInstance.loginRedirect(loginRequest);
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    if (!msalInstance) {
      console.error('MSAL is not initialized yet.');
      return;
    }

    setStatus('Signing out…');
    logoutButton.disabled = true;

    msalInstance
      .logoutRedirect()
      .catch((error) => {
        console.error('Logout error', error);
        setStatus('Unable to sign out. Check the console for details.');
        logoutButton.disabled = false;
      });
  });
}

fetch(resolvePortalAssetUrl('config.json'))
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load config.json: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then((config) => {
    if (!config.azure) {
      throw new Error('Missing Azure B2C configuration.');
    }

    const portalBranding = (config.portal && config.portal.branding) || {};
    const brandingClone = { ...portalBranding };
    const brandingColors =
      portalBranding.colors && typeof portalBranding.colors === 'object'
        ? normaliseColorMap(portalBranding.colors)
        : {};
    const brandingFooter =
      portalBranding.footer && typeof portalBranding.footer === 'object'
        ? { ...portalBranding.footer }
        : {};

    brandingClone.colors = brandingColors;
    brandingClone.footer = brandingFooter;

    defaultPortalConfig = {
      branding: brandingClone,
      roles: (config.portal && config.portal.roles) || {}
    };
    applyBranding();
    renderPortal('anonymous');
    initializeMsal(config.azure);
  })
  .catch((error) => {
    console.error(error);
    setStatus('Unable to load configuration.');
    renderPortal('anonymous');
  });

window.addEventListener('storage', (event) => {
  if (event.key === PORTAL_LINKS_STORAGE_KEY) {
    applyBranding();
    const account = msalInstance ? msalInstance.getActiveAccount() : null;
    showAccountInfo(account || null);
  }
});
