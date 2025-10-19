import {
  announce,
  defaultRoles,
  resolveAsset,
  safeParseJson,
  setBrandingVariables
} from './portal-utils.js';

const draftKey = 'parentIdPassport.draftConfig';
const sessionKey = 'parentIdPassport.adminSession';
const overrideKey = 'parentIdPassport.overrideConfig';

const state = {
  config: null,
  draft: null,
  authenticated: false,
  sessionAuth: null,
  swRegistration: null
};

const clone = typeof structuredClone === 'function'
  ? (value) => structuredClone(value)
  : (value) => JSON.parse(JSON.stringify(value));

const refs = {
  loginForm: document.getElementById('admin-login'),
  usernameInput: document.getElementById('admin-username'),
  passwordInput: document.getElementById('admin-password'),
  activeBar: document.getElementById('admin-active'),
  badge: document.getElementById('admin-user'),
  logout: document.getElementById('admin-logout'),
  save: document.getElementById('admin-save'),
  panels: document.getElementById('admin-panels'),
  branding: {
    title: document.getElementById('branding-title'),
    tagline: document.getElementById('branding-tagline'),
    status: document.getElementById('branding-status'),
    logo: document.getElementById('branding-logo'),
    backgroundImage: document.getElementById('branding-background-image'),
    backgroundColor: document.getElementById('branding-background-color'),
    accent: document.getElementById('branding-accent'),
    card: document.getElementById('branding-card'),
    footer: document.getElementById('branding-footer'),
    privacy: document.getElementById('branding-privacy')
  },
  authentication: {
    autoSaml: document.getElementById('auth-auto-saml'),
    samlUrl: document.getElementById('auth-saml-url')
  },
  azure: {
    clientId: document.getElementById('azure-client-id'),
    authority: document.getElementById('azure-authority'),
    known: document.getElementById('azure-known'),
    redirect: document.getElementById('azure-redirect'),
    postlogout: document.getElementById('azure-postlogout'),
    scopes: document.getElementById('azure-scopes')
  },
  credentials: {
    username: document.getElementById('admin-username-edit'),
    passwordNew: document.getElementById('admin-password-new'),
    passwordConfirm: document.getElementById('admin-password-confirm')
  },
  hero: {
    logo: document.getElementById('admin-logo'),
    background: document.getElementById('admin-background'),
    title: document.getElementById('admin-title'),
    tagline: document.getElementById('admin-tagline')
  },
  footer: document.getElementById('admin-footer'),
  linkEditors: document.getElementById('link-editors')
};

init();

async function init() {
  await registerServiceWorker();
  await loadConfig();
  hydrateSession();
  bindLogin();
  bindLogout();
  bindSave();
  bindBrandingInputs();
  bindAuthenticationInputs();
  bindAzureInputs();
  bindCredentialInputs();
  updateBrandingPreview();
}

async function loadConfig() {
  try {
    const response = await fetch(`./config.json?cacheBust=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.config = payload;
    state.draft = loadDraft(payload);
  } catch (error) {
    console.error('Failed to load configuration', error);
    announce('Unable to load config.json. Using in-memory defaults.');
    state.config = {
      branding: {},
      authentication: {},
      azureB2C: {},
      administrator: { username: 'portal-admin', passwordHash: '', salt: '' },
      links: {}
    };
    state.draft = clone(state.config);
  }
  updateBrandingPreview();
  populateForms();
  renderLinkEditors();
}

function loadDraft(config) {
  const stored = safeParseJson(localStorage.getItem(draftKey), null);
  if (!stored) return clone(config);
  return clone({ ...config, ...stored, links: { ...config.links, ...stored.links } });
}

function hydrateSession() {
  const session = safeParseJson(sessionStorage.getItem(sessionKey), null);
  if (!session) return;
  if (
    state.config?.administrator?.username === session.username &&
    state.config?.administrator?.passwordHash === session.passwordHash
  ) {
    state.authenticated = true;
    state.sessionAuth = session;
    unlockConsole();
  }
}

function bindLogin() {
  refs.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.config?.administrator) {
      announce('Configuration not loaded yet.');
      return;
    }
    const username = refs.usernameInput.value.trim();
    const password = refs.passwordInput.value;
    const salt = state.config.administrator.salt || '';
    const expectedHash = state.config.administrator.passwordHash;
    const actualHash = await hashPassword(salt + password);
    if (
      state.config.administrator.username === username &&
      expectedHash &&
      timingSafeEqual(expectedHash, actualHash)
    ) {
      state.authenticated = true;
      state.sessionAuth = { username, passwordHash: expectedHash };
      sessionStorage.setItem(sessionKey, JSON.stringify(state.sessionAuth));
      unlockConsole();
      announce('Administrator session unlocked.');
    } else {
      announce('Invalid administrator credentials.');
    }
    refs.passwordInput.value = '';
  });
}

function bindLogout() {
  refs.logout.addEventListener('click', () => {
    state.authenticated = false;
    state.sessionAuth = null;
    sessionStorage.removeItem(sessionKey);
    refs.activeBar.hidden = true;
    refs.loginForm.hidden = false;
    refs.panels.hidden = true;
    announce('Administrator session cleared.');
  });
}

function bindSave() {
  refs.save.addEventListener('click', async () => {
    if (!state.authenticated) {
      announce('Unlock the console before saving.');
      return;
    }

    const password = refs.credentials.passwordNew.value;
    const confirm = refs.credentials.passwordConfirm.value;
    if (password || confirm) {
      if (password !== confirm) {
        announce('New passwords do not match.');
        return;
      }
      if (password.length < 8) {
        announce('Choose a password with at least 8 characters.');
        return;
      }
    }

    const payload = clone(state.draft);
    payload.branding = payload.branding || {};
    payload.authentication = payload.authentication || {};
    payload.azureB2C = payload.azureB2C || {};
    payload.links = payload.links || {};
    payload.updated = new Date().toISOString();

    payload.azureB2C.knownAuthorities = splitAndClean(refs.azure.known.value);
    payload.azureB2C.scopes = splitAndClean(refs.azure.scopes.value);

    const username = refs.credentials.username.value.trim() || state.config.administrator.username;
    let salt = state.config.administrator.salt || generateSalt();
    let passwordHash = state.config.administrator.passwordHash;

    if (password) {
      salt = generateSalt();
      passwordHash = await hashPassword(salt + password);
    }

    payload.administrator = { username, salt, passwordHash };

    refs.save.disabled = true;
    try {
      const response = await fetch('./save-config.ashx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth: state.sessionAuth, config: payload })
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${response.status}`);
      }

      state.config = payload;
      state.draft = clone(payload);
      state.sessionAuth = { username: payload.administrator.username, passwordHash: payload.administrator.passwordHash };
      sessionStorage.setItem(sessionKey, JSON.stringify(state.sessionAuth));
      localStorage.setItem(draftKey, JSON.stringify(state.draft));
      pushOverrides(payload);
      refs.badge.textContent = state.sessionAuth.username;
      announce('Configuration saved successfully.');
      refs.credentials.passwordNew.value = '';
      refs.credentials.passwordConfirm.value = '';
      refs.passwordInput.value = '';
      populateForms();
      renderLinkEditors();
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'portal-config-updated', payload });
      }
    } catch (error) {
      console.error('Failed to save configuration', error);
      announce(`Save failed: ${error.message}`);
    } finally {
      refs.save.disabled = false;
    }
  });
}

function bindBrandingInputs() {
  const b = refs.branding;
  b.title.addEventListener('input', () => updateBrandingField('title', b.title.value));
  b.tagline.addEventListener('input', () => updateBrandingField('tagline', b.tagline.value));
  b.status.addEventListener('input', () => updateBrandingField('statusMessage', b.status.value));
  b.logo.addEventListener('input', () => updateBrandingField('logo', b.logo.value));
  b.backgroundImage.addEventListener('input', () => updateBrandingField('backgroundImage', b.backgroundImage.value));
  b.backgroundColor.addEventListener('input', () => updateBrandingField('backgroundColor', b.backgroundColor.value));
  b.accent.addEventListener('input', () => updateBrandingField('accentColor', b.accent.value));
  b.card.addEventListener('input', () => updateBrandingField('cardBackground', b.card.value));
  b.footer.addEventListener('input', () => updateBrandingField('footerHtml', b.footer.value));
  b.privacy.addEventListener('input', () => updateBrandingField('privacyPolicyUrl', b.privacy.value));
}

function bindAuthenticationInputs() {
  refs.authentication.autoSaml.addEventListener('change', () => {
    state.draft.authentication = state.draft.authentication || {};
    state.draft.authentication.autoSamlRedirect = refs.authentication.autoSaml.checked;
    persistDraft();
    pushPreviewOverrides();
  });
  refs.authentication.samlUrl.addEventListener('input', () => {
    state.draft.authentication = state.draft.authentication || {};
    state.draft.authentication.samlRedirectUrl = refs.authentication.samlUrl.value;
    persistDraft();
    pushPreviewOverrides();
  });
}

function bindAzureInputs() {
  const a = refs.azure;
  const update = () => {
    state.draft.azureB2C = state.draft.azureB2C || {};
    state.draft.azureB2C.clientId = a.clientId.value.trim();
    state.draft.azureB2C.authority = a.authority.value.trim();
    state.draft.azureB2C.redirectUri = a.redirect.value.trim();
    state.draft.azureB2C.postLogoutRedirectUri = a.postlogout.value.trim();
    state.draft.azureB2C.knownAuthorities = splitAndClean(a.known.value);
    state.draft.azureB2C.scopes = splitAndClean(a.scopes.value);
    persistDraft();
    pushPreviewOverrides();
  };
  a.clientId.addEventListener('input', update);
  a.authority.addEventListener('input', update);
  a.redirect.addEventListener('input', update);
  a.postlogout.addEventListener('input', update);
  a.known.addEventListener('input', update);
  a.scopes.addEventListener('input', update);
}

function bindCredentialInputs() {
  refs.credentials.username.addEventListener('input', () => {
    state.draft.administrator = state.draft.administrator || clone(state.config.administrator || {});
    state.draft.administrator.username = refs.credentials.username.value.trim();
    persistDraft();
  });
}

function updateBrandingField(field, value) {
  state.draft.branding = state.draft.branding || {};
  state.draft.branding[field] = value;
  persistDraft();
  updateBrandingPreview();
  pushPreviewOverrides();
}

function updateBrandingPreview() {
  const branding = state.draft?.branding || {};
  setBrandingVariables(branding);
  if (branding.title) {
    refs.hero.title.textContent = branding.title;
  }
  if (branding.tagline) {
    refs.hero.tagline.textContent = branding.tagline;
  }
  if (branding.logo) {
    refs.hero.logo.src = resolveAsset(branding.logo);
  }
  if (branding.backgroundImage) {
    refs.hero.background.src = resolveAsset(branding.backgroundImage);
  }
  refs.footer.innerHTML = branding.footerHtml || '<strong>ParentIDPassport</strong> © 2024.';
}

function populateForms() {
  if (!state.draft) return;
  const branding = state.draft.branding || {};
  refs.branding.title.value = branding.title || '';
  refs.branding.tagline.value = branding.tagline || '';
  refs.branding.status.value = branding.statusMessage || '';
  refs.branding.logo.value = branding.logo || '';
  refs.branding.backgroundImage.value = branding.backgroundImage || '';
  refs.branding.backgroundColor.value = branding.backgroundColor || '#f5f7ff';
  refs.branding.accent.value = branding.accentColor || '#4f46e5';
  refs.branding.card.value = branding.cardBackground || 'rgba(255,255,255,0.8)';
  refs.branding.footer.value = branding.footerHtml || '';
  refs.branding.privacy.value = branding.privacyPolicyUrl || '';

  const auth = state.draft.authentication || {};
  refs.authentication.autoSaml.checked = Boolean(auth.autoSamlRedirect);
  refs.authentication.samlUrl.value = auth.samlRedirectUrl || '';

  const azure = state.draft.azureB2C || {};
  refs.azure.clientId.value = azure.clientId || '';
  refs.azure.authority.value = azure.authority || '';
  refs.azure.known.value = (azure.knownAuthorities || []).join(', ');
  refs.azure.redirect.value = azure.redirectUri || '';
  refs.azure.postlogout.value = azure.postLogoutRedirectUri || '';
  refs.azure.scopes.value = (azure.scopes || []).join(', ');

  refs.credentials.username.value = state.config?.administrator?.username || '';
}

function renderLinkEditors() {
  const container = refs.linkEditors;
  container.innerHTML = '';
  state.draft.links = state.draft.links || {};
  const links = state.draft.links;

  for (const role of defaultRoles) {
    if (!links[role]) links[role] = [];
    const wrapper = document.createElement('section');
    wrapper.className = 'link-list';

    const heading = document.createElement('h3');
    heading.textContent = roleHeading(role);
    wrapper.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'link-list';

    links[role].forEach((link, index) => {
      list.appendChild(createLinkEditor(role, index, link));
    });

    const addButton = document.createElement('button');
    addButton.className = 'primary';
    addButton.type = 'button';
    addButton.textContent = `Add ${roleHeading(role, true).toLowerCase()} link`;
    addButton.addEventListener('click', () => {
      links[role].push({ title: '', url: '', description: '', icon: 'link' });
      persistDraft();
      pushPreviewOverrides();
      renderLinkEditors();
    });

    wrapper.appendChild(list);
    wrapper.appendChild(addButton);
    container.appendChild(wrapper);
  }
}

function createLinkEditor(role, index, link) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'link-editor';
  const legend = document.createElement('legend');
  legend.textContent = `${roleHeading(role)} link ${index + 1}`;
  fieldset.appendChild(legend);

  const makeInput = (labelText, type, value, field) => {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.value = value || '';
    input.addEventListener('input', () => {
      updateLink(role, index, field, type === 'number' ? Number(input.value) : input.value);
    });
    label.appendChild(input);
    return label;
  };

  fieldset.appendChild(makeInput('Title', 'text', link.title, 'title'));
  fieldset.appendChild(makeInput('Description', 'textarea', link.description, 'description'));
  fieldset.appendChild(makeInput('URL', 'url', link.url, 'url'));
  fieldset.appendChild(makeInput('Icon', 'text', link.icon, 'icon'));
  fieldset.appendChild(makeInput('Background color', 'text', link.backgroundColor, 'backgroundColor'));
  fieldset.appendChild(makeInput('Text color', 'text', link.textColor, 'textColor'));
  fieldset.appendChild(makeInput('Border color', 'text', link.borderColor, 'borderColor'));
  const opacityInput = makeInput('Opacity (0-1)', 'number', link.opacity ?? 1, 'opacity');
  opacityInput.querySelector('input').step = '0.05';
  opacityInput.querySelector('input').min = '0';
  opacityInput.querySelector('input').max = '1';
  fieldset.appendChild(opacityInput);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'primary';
  remove.textContent = 'Remove link';
  remove.addEventListener('click', () => {
    state.draft.links[role].splice(index, 1);
    persistDraft();
    pushPreviewOverrides();
    renderLinkEditors();
  });
  fieldset.appendChild(remove);

  return fieldset;
}

function updateLink(role, index, field, value) {
  state.draft.links[role][index] = state.draft.links[role][index] || {};
  if (field === 'opacity') {
    const numeric = Number.isFinite(value) ? value : Number(value);
    state.draft.links[role][index][field] = Math.min(Math.max(numeric || 0, 0), 1);
  } else {
    state.draft.links[role][index][field] = value;
  }
  persistDraft();
  pushPreviewOverrides();
}

function unlockConsole() {
  refs.loginForm.hidden = true;
  refs.activeBar.hidden = false;
  refs.panels.hidden = false;
  refs.badge.textContent = state.sessionAuth.username;
  pushPreviewOverrides();
}

function persistDraft() {
  if (!state.draft) return;
  localStorage.setItem(draftKey, JSON.stringify(state.draft));
}

function pushPreviewOverrides() {
  if (!state.draft) return;
  const preview = {
    branding: state.draft.branding,
    links: state.draft.links,
    authentication: state.draft.authentication,
    azureB2C: state.draft.azureB2C
  };
  localStorage.setItem(overrideKey, JSON.stringify(preview));
}

function pushOverrides(config) {
  const preview = {
    branding: config.branding,
    links: config.links,
    authentication: config.authentication,
    azureB2C: config.azureB2C
  };
  localStorage.setItem(overrideKey, JSON.stringify(preview));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    state.swRegistration = await navigator.serviceWorker.register('./service-worker.js');
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}

function splitAndClean(value = '') {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function roleHeading(role, singular = false) {
  switch (role) {
    case 'parents':
      return singular ? 'Parent' : 'Parents & guardians';
    case 'students':
      return singular ? 'Student' : 'Students';
    case 'staff':
      return singular ? 'Staff' : 'Staff';
    default:
      return singular ? 'Guest' : 'Anonymous visitors';
  }
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(value) {
  const encoded = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
