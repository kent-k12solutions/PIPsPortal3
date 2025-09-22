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

const COLOR_FIELDS = [
  { key: 'background', label: 'Page background colour', placeholder: '#f5f7fb' },
  { key: 'surface', label: 'Main surface colour', placeholder: '#ffffff' },
  { key: 'surfaceSubtle', label: 'Subtle surface background', placeholder: 'rgba(247, 250, 255, 0.6)' },
  { key: 'primary', label: 'Primary brand colour', placeholder: '#1d4ed8' },
  { key: 'primaryDark', label: 'Primary dark colour', placeholder: '#1a3696' },
  { key: 'primaryAccent', label: 'Primary accent colour', placeholder: '#2563eb' },
  { key: 'text', label: 'Main text colour', placeholder: '#1f2937' },
  { key: 'muted', label: 'Muted text colour', placeholder: '#6b7280' },
  { key: 'border', label: 'Border colour', placeholder: '#e5e7eb' },
  { key: 'headerOverlay', label: 'Header overlay colour', placeholder: 'rgba(255, 255, 255, 0.85)' },
  { key: 'sessionButtonBackground', label: 'Session button background', placeholder: 'rgba(255, 255, 255, 0.85)' },
  { key: 'emptyStateBackground', label: 'Empty state background', placeholder: 'rgba(107, 114, 128, 0.12)' },
  { key: 'tertiaryButtonBackground', label: 'Secondary surface colour', placeholder: '#ffffff' },
  { key: 'danger', label: 'Danger colour', placeholder: '#dc2626' },
  { key: 'footerBackground', label: 'Footer background colour', placeholder: '#ffffff' },
  { key: 'footerText', label: 'Footer text colour', placeholder: '#6b7280' },
  { key: 'footerLink', label: 'Footer link colour', placeholder: '#1d4ed8' }
];

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
  const response = await fetch('config.json');
  if (!response.ok) {
    throw new Error(`Unable to load config.json (${response.status} ${response.statusText})`);
  }

  const config = await response.json();
  adminCredentials = config.admin || { username: '', passwordHash: '' };
  defaultPortalConfig = {
    branding: (config.portal && config.portal.branding) || {},
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
  currentPortalConfig.branding.colors = { ...defaultColors, ...currentColors };

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
  const defaultColors =
    defaultBrandingConfig.colors && typeof defaultBrandingConfig.colors === 'object'
      ? defaultBrandingConfig.colors
      : {};
  const defaultFooter =
    defaultBrandingConfig.footer && typeof defaultBrandingConfig.footer === 'object'
      ? defaultBrandingConfig.footer
      : {};
  const colors = branding.colors && typeof branding.colors === 'object' ? branding.colors : {};
  const footer = branding.footer && typeof branding.footer === 'object' ? branding.footer : {};

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
  form.appendChild(logoLabel);
  form.appendChild(backgroundLabel);

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
  colourHint.textContent = 'Accepts any CSS colour value (hex, rgb, hsl, etc.). Leave a field blank to use the default.';
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
    colorInput.placeholder = defaultColors[field.key] || field.placeholder || '';
    colorInput.autocomplete = 'off';
    colorInput.spellcheck = false;
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
    currentPortalConfig.branding = deepClone(defaultPortalConfig.branding || {});
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

  const colorOverrides = {};
  COLOR_FIELDS.forEach((field) => {
    const rawValue = formData.get(`color-${field.key}`);
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed) {
        colorOverrides[field.key] = trimmed;
      }
    }
  });

  const defaultBrandingConfig =
    defaultPortalConfig.branding && typeof defaultPortalConfig.branding === 'object'
      ? defaultPortalConfig.branding
      : {};
  const defaultColors =
    defaultBrandingConfig.colors && typeof defaultBrandingConfig.colors === 'object'
      ? defaultBrandingConfig.colors
      : {};
  const mergedColors = {
    ...defaultColors,
    ...colorOverrides
  };

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
  iconInput.placeholder = 'https://cdn.example.com/icon.svg';
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
