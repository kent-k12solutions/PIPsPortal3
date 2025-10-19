import {
  announce,
  buildLinkIcon,
  clamp,
  getReadableTextColor,
  resolveAsset,
  safeParseJson,
  setBrandingVariables
} from './portal-utils.js';

const defaultPortalConfig = {
  azureB2C: {
    clientId: '00000000-0000-0000-0000-000000000000',
    authority: 'https://example.b2clogin.com/example.onmicrosoft.com/B2C_1_signupsignin',
    knownAuthorities: ['example.b2clogin.com'],
    redirectUri: window.location.origin + '/index.html',
    postLogoutRedirectUri: window.location.origin + '/index.html',
    scopes: ['https://example.onmicrosoft.com/api/demo.read']
  },
  administrator: {},
  branding: {
    title: 'ParentIDPassport',
    tagline: 'Your family digital access companion',
    statusMessage: 'Sign in to access personalized campus resources.',
    logo: './images/logo.svg',
    backgroundImage: './images/background.svg',
    accentColor: '#4f46e5',
    accentForeground: '#ffffff',
    backgroundColor: '#f5f7ff',
    cardBackground: 'rgba(255,255,255,0.8)',
    cardBackdrop: 'rgba(79, 70, 229, 0.08)',
    footerHtml: '<strong>ParentIDPassport</strong> © 2024. All rights reserved.',
    privacyPolicyUrl: '#'
  },
  authentication: {
    autoSamlRedirect: false,
    samlRedirectUrl: ''
  },
  links: {
    anonymous: [],
    parents: [],
    students: [],
    staff: []
  }
};

const state = {
  config: defaultPortalConfig,
  baseConfig: defaultPortalConfig,
  overrides: null,
  account: null,
  msalApp: null,
  swRegistration: null,
  msalLoadPromise: null,
  authHandlersBound: false
};

const overrideKey = 'parentIdPassport.overrideConfig';

const clone = typeof structuredClone === 'function'
  ? (value) => structuredClone(value)
  : (value) => JSON.parse(JSON.stringify(value));

const elements = {
  title: document.getElementById('portal-title'),
  tagline: document.getElementById('portal-tagline'),
  status: document.getElementById('portal-status'),
  logo: document.getElementById('portal-logo'),
  background: document.getElementById('portal-background'),
  footer: document.getElementById('footer-html'),
  privacy: document.getElementById('privacy-link'),
  linksGrid: document.getElementById('links-grid'),
  roleSelector: document.getElementById('role-selector'),
  roleLabel: document.getElementById('role-label'),
  signin: document.getElementById('signin-button'),
  signout: document.getElementById('signout-button'),
  account: document.getElementById('account-display')
};

registerServiceWorker();
loadPortalConfig();
setupRoleSelector();
setupStorageListener();

const msalScriptSources = [

  'scripts/msal-browser-2.38.4.min.js',
  'https://alcdn.msauth.net/browser/2.38.4/js/msal-browser.min.js',
  'https://alcdn.msftauth.net/browser/2.38.4/js/msal-browser.min.js',
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.4/lib/msal-browser.min.js'
];

async function loadPortalConfig() {
  try {
    const response = await fetch(`./config.json?cacheBust=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.baseConfig = payload;
    state.config = mergeWithOverrides(payload);
    applyBranding(state.config.branding);
    renderLinks(elements.roleSelector.value);
    await initialiseMsal(state.config.azureB2C);
    maybeAutoRedirect();
  } catch (error) {
    console.error('Unable to load configuration', error);
    announce('Unable to load configuration. Using defaults.');
    state.baseConfig = defaultPortalConfig;
    state.config = mergeWithOverrides(defaultPortalConfig);
    applyBranding(state.config.branding);
    renderLinks(elements.roleSelector.value);
    await initialiseMsal(state.config.azureB2C);
    maybeAutoRedirect();
  }
}

async function ensureMsalLoaded() {
  if (window.msal) {
    return true;
  }

  if (!state.msalLoadPromise) {
    state.msalLoadPromise = loadMsalSequentially();
  }

  try {
    await state.msalLoadPromise;
  } catch (error) {
    console.error('Unable to load MSAL library', error);
    state.msalLoadPromise = null;
    announce('Authentication is temporarily unavailable. Please try again later.');
  }

  return typeof window.msal !== 'undefined';
}

async function loadMsalSequentially() {
  for (const source of msalScriptSources) {
    try {
      await injectScript(source);
      if (window.msal) {
        return;
      }
    } catch (error) {
      console.warn(`Failed to load MSAL from ${source}`, error);
    }
  }

  throw new Error('All MSAL sources failed');
}

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function mergeWithOverrides(config) {
  const stored = safeParseJson(localStorage.getItem(overrideKey), null);
  state.overrides = stored;
  if (!stored) {
    return config;
  }

  const mergedBranding = mergeObjects(config.branding, stored.branding);
  const mergedAuthentication = mergeObjects(config.authentication, stored.authentication);
  const mergedAzure = mergeAzureConfig(config.azureB2C, stored.azureB2C);
  const mergedLinks = mergeLinks(config.links, stored.links);

  return clone({
    ...config,
    ...stored,
    branding: mergedBranding,
    authentication: mergedAuthentication,
    azureB2C: mergedAzure,
    links: mergedLinks
  });
}

function mergeLinks(base = {}, overrides = {}) {
  const merged = { ...base };
  for (const role of Object.keys(overrides || {})) {
    merged[role] = overrides[role];
  }
  return merged;
}

function mergeObjects(base = {}, overrides = {}) {
  if (!overrides) {
    return base;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined') {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function mergeAzureConfig(base = {}, overrides = {}) {
  if (!overrides) {
    return base;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined' || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      merged[key] = [...value];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function applyBranding(branding = {}) {
  setBrandingVariables(branding);
  if (branding.title) {
    document.title = branding.title;
    elements.title.textContent = branding.title;
  }
  if (branding.tagline) {
    elements.tagline.textContent = branding.tagline;
    elements.tagline.hidden = false;
  } else {
    elements.tagline.hidden = true;
  }
  if (branding.statusMessage) {
    elements.status.textContent = branding.statusMessage;
  }
  if (branding.logo) {
    elements.logo.src = resolveAsset(branding.logo);
  }
  if (branding.backgroundImage) {
    elements.background.src = resolveAsset(branding.backgroundImage);
  }
  if (branding.footerHtml) {
    elements.footer.innerHTML = branding.footerHtml;
  }
  if (branding.privacyPolicyUrl) {
    elements.privacy.href = branding.privacyPolicyUrl;
  }
}

function setupRoleSelector() {
  elements.roleSelector.addEventListener('change', (event) => {
    const role = event.target.value;
    renderLinks(role);
  });
}

function renderLinks(role) {
  const configLinks = state.config.links?.[role] ?? [];
  elements.roleLabel.textContent = describeRole(role);
  elements.linksGrid.innerHTML = '';

  if (!configLinks.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'link-card';
    emptyState.innerHTML = `<h3>No links yet</h3><p>Resources for this role will appear here once an administrator publishes them.</p>`;
    elements.linksGrid.appendChild(emptyState);
    return;
  }

  for (const link of configLinks) {
    const card = document.createElement('article');
    card.className = 'link-card';
    const backgroundColor = link.backgroundColor || 'var(--portal-card-background)';
    const textColor = link.textColor || getReadableTextColor(backgroundColor);
    const borderColor = link.borderColor || 'var(--portal-card-border)';
    const opacity = clamp(link.opacity ?? 1, 0.1, 1);

    card.style.background = backgroundColor;
    card.style.color = textColor;
    card.style.borderColor = borderColor;
    card.style.opacity = opacity;

    const title = document.createElement('h3');
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = buildLinkIcon(link.icon);
    title.append(icon, document.createTextNode(` ${link.title || 'Untitled link'}`));
    card.appendChild(title);

    if (link.description) {
      const description = document.createElement('p');
      description.textContent = link.description;
      card.appendChild(description);
    }

    const anchor = document.createElement('a');
    anchor.href = resolveAsset(link.url || '#');
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = 'Open';
    card.appendChild(anchor);

    elements.linksGrid.appendChild(card);
  }
}

function describeRole(role) {
  switch (role) {
    case 'parents':
      return 'Tailored for parents & guardians';
    case 'students':
      return 'Tailored for students';
    case 'staff':
      return 'Tailored for campus staff';
    default:
      return 'Tailored for guests';
  }
}

async function initialiseMsal(azureConfig) {
  const msalAvailable = await ensureMsalLoaded();
  if (!msalAvailable || !azureConfig?.clientId) {
    console.warn('MSAL library not available or misconfigured');
    updateAccountDisplay();
    return;
  }

  const config = {
    auth: {
      clientId: azureConfig.clientId,
      authority: azureConfig.authority,
      knownAuthorities: azureConfig.knownAuthorities || [],
      redirectUri: azureConfig.redirectUri || window.location.origin + '/index.html',
      postLogoutRedirectUri: azureConfig.postLogoutRedirectUri || window.location.origin + '/index.html'
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false
    }
  };

  state.msalApp = new msal.PublicClientApplication(config);
  state.msalApp.handleRedirectPromise().then((result) => {
    if (result) {
      const account = result.account || state.msalApp.getAllAccounts()[0];
      if (account) {
        state.msalApp.setActiveAccount(account);
      }
    }
    state.account = state.msalApp.getActiveAccount();
    updateAccountDisplay();
  }).catch((error) => {
    console.error('MSAL redirect handling failed', error);
    announce('Authentication error. Check Azure AD B2C configuration.');
  });

  if (!state.authHandlersBound) {
    elements.signin.addEventListener('click', () => {
      const currentConfig = state.config.azureB2C || azureConfig;
      state.msalApp.loginRedirect({
        scopes: currentConfig?.scopes || [],
        redirectStartPage: window.location.href
      });
    });

    elements.signout.addEventListener('click', () => {
      const account = state.msalApp.getActiveAccount();
      state.msalApp.logoutRedirect({ account });
    });

    state.authHandlersBound = true;
  }

  const account = state.msalApp.getActiveAccount();
  if (account) {
    state.account = account;
    updateAccountDisplay();
  }
}

function updateAccountDisplay() {
  if (state.account) {
    elements.account.textContent = `${state.account.name || state.account.username}`;
    elements.account.hidden = false;
    elements.signin.hidden = true;
    elements.signout.hidden = false;
  } else {
    elements.account.hidden = true;
    elements.signin.hidden = false;
    elements.signout.hidden = true;
  }
}

function setupStorageListener() {
  window.addEventListener('storage', (event) => {
    if (event.key === overrideKey) {
      state.config = mergeWithOverrides(state.baseConfig);
      applyBranding(state.config.branding);
      renderLinks(elements.roleSelector.value);
    }
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    state.swRegistration = await navigator.serviceWorker.register('./service-worker.js');
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}

function maybeAutoRedirect() {
  const auth = state.config.authentication;
  if (auth?.autoSamlRedirect && auth.samlRedirectUrl) {
    const flagKey = 'parentIdPassport.samlRedirect';
    if (!sessionStorage.getItem(flagKey)) {
      sessionStorage.setItem(flagKey, 'true');
      window.location.href = auth.samlRedirectUrl;
    }
  }
}
