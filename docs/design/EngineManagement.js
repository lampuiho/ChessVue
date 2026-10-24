'use strict';
const _dialog = document.querySelector('#engine-dialog');
let _router;
let _returnFocus;
const _defaultPath = 'engines/bundled/stockfish-19/';
const _defaultEntry = 'stockfish-19-lite-single.js';
let _packages = [];
let _profiles = [];
let _acceptedProfiles = [];
let _resumeAnalysis = true;
let _acceptedResumeAnalysis = true;
let _opener;
let _openerAction;
let _installOperation;
let _editor;
function _escape(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function _button(label, action, id = '', variant = '') {
  return `<button type="button" class="text-button ${variant}" data-action="${action}" data-id="${_escape(id)}">${label}</button>`;
}
function _isBrowser() { return document.querySelector('#preview-host').value === 'browser'; }
function _findPackage(path) { return _packages.find((entry) => entry.packagePath === path); }
function _defaultPackage() { return { packagePath: _defaultPath, name: 'Stockfish 19', version: '19.0.1', source: 'bundled', files: [_defaultEntry, 'stockfish-19-lite-single.wasm'] }; }
function _packageForEntry(path) { return _packages.find((entry) => path.startsWith(entry.packagePath)); }
function _packageInfo(path) {
  if (_isBrowser()) return _findPackage(path) ?? _packageForEntry(path);
  if (!path || path.startsWith('browser-engines/')) return undefined;
  if (path.startsWith(_defaultPath)) return { ..._defaultPackage(), missing: document.querySelector('#preview-state').value === 'missing' };
  return { packagePath: path, name: path.split(/[\\/]/).filter(Boolean).at(-1), source: 'user' };
}
function _packageAvailability(entry) { return !entry || entry.missing ? 'Package folder or files are unavailable. Choose or restore the package.' : ''; }
function _availability(profile) {
  if (profile.launch.clientType === 'uci') return _isBrowser() ? 'Available in the desktop app.' : profile.launch.entryPath ? '' : 'Choose an executable path.';
  if (!/\.m?js$/i.test(profile.launch.entryPath)) return 'Choose the engine entry script.';
  const entry = _packageInfo(profile.launch.entryPath);
  if (_isBrowser() && entry && !entry.files.includes(profile.launch.entryPath.slice(entry.packagePath.length))) return 'This entry script is missing from the package.';
  return _packageAvailability(entry);
}
function _targetSummary(profile) {
  if (profile.launch.clientType === 'uci') return `Desktop executable &middot; ${_escape(profile.launch.entryPath)}`;
  return `Browser engine &middot; ${_escape(profile.launch.entryPath)}`;
}
function _dirty() { return JSON.stringify(_profiles) !== JSON.stringify(_acceptedProfiles) || _resumeAnalysis !== _acceptedResumeAnalysis; }
function _tag(text, variant = '') { return `<span class="ed-tag ${variant ? `ed-tag--${variant}` : ''}">${text}</span>`; }
function _notify(message) {
  const feedback = document.querySelector('#feedback');
  feedback.innerHTML = message;
  feedback.hidden = false;
}
function _renderPackage(entry) {
  const unavailable = _packageAvailability(entry);
  const actions = unavailable ? _button('Reinstall', 'repair', entry.packagePath) : _button('Create profile', 'create-for', entry.packagePath);
  return `<article class="ed-row"><span class="ed-mark" aria-hidden="true">&#9822;</span><div class="ed-row__copy"><div class="ed-row__title"><h3>${_escape(entry.name)}</h3>${entry.source === 'bundled' ? _tag('Included with ChessVue') : ''}${_tag(unavailable ? 'Files missing' : 'Files available', unavailable ? 'error' : 'ready')}</div><p>${entry.version ? `${_escape(entry.version)} &middot; ` : ''}${unavailable || 'Choose an entry script when creating a profile'}</p></div><div class="ed-row__actions">${actions}${_button('Details', 'details', entry.packagePath)}${_button('Remove', 'remove-package', entry.packagePath, 'text-button--ghost')}</div></article>`;
}
function _renderProfile(profile) {
  const unavailable = _availability(profile);
  const options = profile.options.map((option) => `${_escape(option.name)} ${_escape(option.value)}`).join(' &middot; ') || 'Default engine options';
  return `<article class="ed-row"><span class="ed-mark" aria-hidden="true">&#9822;</span><div class="ed-row__copy"><div class="ed-row__title"><h3>${_escape(profile.name)}</h3>${unavailable ? _tag('Unavailable', 'warning') : ''}</div><p>${_targetSummary(profile)}</p><p>${unavailable || options}</p></div><div class="ed-row__actions">${_button('Copy', 'copy-profile', profile.id)}${_button('Edit', 'edit-profile', profile.id)}${_button('Delete', 'delete-profile', profile.id, 'text-button--ghost')}</div></article>`;
}
function _render() {
  document.querySelector('#unsaved').hidden = !_dirty();
  if (!document.querySelector('#engine-overview')) return;
  document.querySelector('#packages-section').hidden = !_isBrowser();
  document.querySelector('#installed-engines').innerHTML = _packages.map(_renderPackage).join('') || '<div class="ed-empty"><h3>No browser engines installed</h3><p>Import a package, then create a profile to choose it in a game.</p></div>';
  document.querySelector('#engine-profiles').innerHTML = _profiles.map(_renderProfile).join('') || `<div class="ed-empty"><h3>No engine profiles</h3><p>${_isBrowser() ? 'Create a profile from an imported package.' : 'Add a profile pointing to an executable or package folder.'}</p></div>`;
  document.querySelector('#restore-default').hidden = _packages.some((entry) => entry.source === 'bundled');
  document.querySelector('#profile-help').textContent = _isBrowser() ? 'Reusable names and options for games. Apply or Save to keep profile changes.' : 'Names, executable or engine script paths, and options for games. Apply or Save to keep changes.';
  document.querySelector('#unsaved').hidden = !_dirty();
  document.querySelector('#apply-settings').disabled = !_dirty();
  document.querySelector('#save-settings').disabled = !_dirty();
  document.querySelector('#draft-summary').textContent = _dirty() ? 'Profile and behaviour changes are not saved yet' : 'All profile changes saved';
  document.querySelector('#resume-analysis').checked = _resumeAnalysis;
}
function _resetPreview() {
  if (_installOperation) return;
  if (_dialog.open) _dialog.close();
  if (_router) void _router.replace({ name: 'engine-overview' });
  _packages = [_defaultPackage()];
  _profiles = [{ id: 'standard', name: 'Stockfish', launch: { clientType: 'uciWorker', entryPath: _defaultPath + _defaultEntry }, options: [] }, { id: 'practice', name: 'My desktop engine', launch: { clientType: 'uci', entryPath: 'C:\\Engines\\engine.exe' }, options: [{ name: 'Hash', value: '128' }] }];
  const state = document.querySelector('#preview-state').value;
  if (state === 'missing') _packages[0].missing = true;
  if (state === 'empty') { _packages = []; _profiles = []; }
  _acceptedProfiles = structuredClone(_profiles);
  _resumeAnalysis = true;
  _acceptedResumeAnalysis = true;
  document.querySelector('#feedback').hidden = true;
  _render();
}
function _showDialog(title, subtitle, body, actions, focusSelector) {
  _dialog.innerHTML = `<header class="modal-card__header"><div><h2 id="dialog-title" class="modal-card__title">${title}</h2><p class="modal-card__subtitle">${subtitle}</p></div><button type="button" class="icon-button modal-card__close" data-action="close" aria-label="Close dialog">&times;</button></header><div class="ed-dialog__body">${body}</div><footer class="ed-dialog__footer">${actions}</footer>`;
  if (!_dialog.open) _dialog.showModal();
  (focusSelector ? _dialog.querySelector(focusSelector) : _dialog.querySelector('button, input, select'))?.focus();
}
function _closeDialog() {
  _dialog.close();
  const survivingOpener = _opener?.isConnected ? _opener : [...document.querySelectorAll('[data-action]')].find((button) => button.dataset.action === _openerAction?.action && button.dataset.id === _openerAction?.id);
  (survivingOpener ?? document.querySelector('.ed-page-title')).focus();
}
function _navigate(to) {
  if (_router.currentRoute.value.name === 'engine-overview') _returnFocus = _openerAction;
  return _router.push(to);
}
function _openProfile(profileId = '', packagePath = '', copy = false) {
  return _navigate(profileId
    ? { name: copy ? 'engine-profile-copy' : 'engine-profile-edit', params: { profileId } }
    : { name: 'engine-profile-new', query: packagePath ? { packagePath } : {} });
}
function _openImport(packagePath = '') {
  return _navigate({ name: 'engine-package-import', query: packagePath ? { packagePath } : {} });
}
function _openDetails(packagePath) {
  return _navigate({ name: 'engine-package-details', query: { packagePath } });
}
async function _returnToEngines(replace = false) {
  await _router[replace ? 'replace' : 'push']({ name: 'engine-overview' });
  await Vue.nextTick();
}
function _renderPage(title, subtitle, body, actions, focusSelector) {
  const page = document.querySelector('[data-engine-route] .ed-engine-view');
  page.innerHTML = `<button type="button" class="text-button text-button--ghost ed-engine-view__back" data-action="return-engines">&larr; Back to engines</button><header class="ed-engine-view__header"><h2 id="engine-view-title" tabindex="-1">${title}</h2><p>${subtitle}</p></header><div class="ed-engine-view__body">${body}</div><footer class="ed-engine-view__footer">${actions}</footer>`;
  document.querySelector('#feedback').hidden = true;
  document.querySelector('.ed-content').scrollTop = 0;
  page.querySelector(focusSelector ?? '#engine-view-title')?.focus();
}
function _mountOverview() {
  _render();
  const action = _returnFocus;
  const target = [...document.querySelectorAll('#engine-overview [data-action]')].find(button => button.dataset.action === action?.action && button.dataset.id === action?.id);
  (target ?? document.querySelector('.ed-page-title')).focus();
}

function _setPreviewBusy(busy) {
  for (const control of document.querySelectorAll('#preview-host, #preview-state, [data-action="reset-preview"]')) control.disabled = busy;
}
function _showRestore() {
  _showDialog('Restore included engine', 'Stockfish is available from the package included with ChessVue.', '<dl class="ed-metadata"><dt>Engine</dt><dd>Stockfish 19</dd><dt>Version</dt><dd>19.0.1</dd><dt>Source</dt><dd>Included with ChessVue</dd></dl><p class="ed-form__copy">Restore this package in browser storage. Existing profiles keep their saved paths and options.</p>', `${_button('Cancel', 'close')}${_button('Restore engine', 'start-install', 'restore-stockfish', 'text-button--primary')}`);
}
function _renderImportView(route) {
  if (!_isBrowser()) {
    _renderPage('Install browser engine', 'Package import is unavailable here.', '<p class="ed-form__copy">Use an executable or entry script directly in a desktop profile.</p>', _button('Back to engines', 'return-engines'));
    return;
  }
  const repairPath = typeof route.query.packagePath === 'string' ? route.query.packagePath : '';
  const file = `<div class="ed-file"><div><strong>Choose a browser engine package</strong><small>Choose the engine archive. Its original files and layout are preserved.</small></div>${_button('Choose package', 'choose-package', repairPath)}</div>`;
  _renderPage(repairPath ? 'Reinstall browser engine' : 'Install browser engine', 'Package imports take effect immediately. Profiles are saved separately.', `${file}<div id="package-review"></div>`, `${_button('Cancel', 'return-engines')}<button id="install-confirm" type="button" class="text-button text-button--primary" data-action="start-install" data-id="${_escape(repairPath)}" disabled>Install engine</button>`, '[data-action="choose-package"]');
}
function _choosePackage(repairPath) {
  const entry = _findPackage(repairPath);
  const review = document.querySelector('#package-review');
  if (document.querySelector('#preview-state').value === 'invalidArchive') {
    review.innerHTML = '<p class="inline-message inline-message--error" role="alert">The archive contains paths that cannot be imported. Choose another package.</p>';
    return;
  }
  const files = entry?.files ?? ['training-engine.js', 'helper.js'];
  review.innerHTML = `<div class="ed-form"><dl class="ed-metadata"><dt>Selected file</dt><dd>${repairPath ? 'stockfish-19' : 'training-engine'}.zip</dd><dt>Package</dt><dd>${_escape(entry?.name ?? 'training-engine')}</dd><dt>Version</dt><dd>${_escape(entry?.version ?? 'Not supplied')}</dd><dt>Files</dt><dd>${files.map(_escape).join(', ')}</dd></dl><p class="ed-form__copy">The original files will be saved in this browser. Create a profile after import to choose its entry and interface.</p></div>`;
  document.querySelector('#install-confirm').disabled = false;
}
function _delay(signal, duration) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', _abort); resolve(); }, duration);
    function _abort() { window.clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener('abort', _abort, { once: true });
  });
}
function _renderProgress(stage) {
  const labels = ['Reading package files', 'Saving package files'];
  const body = `<div role="status" aria-live="polite">${labels.map((label, index) => `<div class="ed-stage ${index < stage ? 'ed-stage--done' : index === stage ? 'ed-stage--active' : ''}"><span class="ed-stage__number">${index < stage ? '&#10003;' : index + 1}</span>${label}</div>`).join('')}</div><p class="ed-form__copy">${stage < 1 ? 'You can cancel while ChessVue reads the package.' : 'Finishing the import into browser storage. Finishing the file write; this action will be available again shortly.'}</p>`;
  _renderPage('Installing browser engine', 'The package becomes available after its files are saved.', body, stage < 1 ? _button('Cancel installation', 'return-engines') : '<button type="button" class="text-button" disabled>Finishing...</button>');
  document.querySelector('[data-engine-route] [data-action="return-engines"]').disabled = stage === 1;
}
function _startInstall(button) {
  if (_installOperation || !_isBrowser()) return;
  if (_dialog.open) _closeDialog();
  const operation = { controller: new AbortController(), committing: false, completion: undefined };
  _installOperation = operation;
  _setPreviewBusy(true);
  operation.completion = _installFiles(operation, button.dataset.id);
  return operation.completion;
}
async function _installFiles(operation, packagePath) {
  const signal = operation.controller.signal;
  try {
    _renderProgress(0);
    await _delay(signal, 350);
    operation.committing = true;
    _renderProgress(1);
    await _delay(signal, 350);
    const entry = _publishPackage(packagePath);
    _render();
    _renderPage('Browser engine installed', 'The original package files are saved in this browser.', `<div class="ed-success"><h3>&#10003; ${_escape(entry.name)} is installed</h3><p>The package files are stored. Engine startup uses the existing game flow.</p></div><p class="ed-form__copy">Create a profile to choose an entry and interface. The original package layout is preserved.</p>`, `${_button('Done', 'return-engines')}${_button('Create profile', 'create-for', entry.packagePath, 'text-button--primary')}`);
  } catch (error) {
    if (!signal.aborted) _renderPage('Package import failed', 'The package has not been imported.', `<p class="inline-message inline-message--error" role="alert">${_escape(error.message)}</p>`, `${_button('Cancel', 'return-engines')}${_button('Choose another package', 'repair', packagePath, 'text-button--primary')}`);
  } finally { _installOperation = undefined; _setPreviewBusy(false); }
}
async function _settleImportBeforeLeave() {
  const operation = _installOperation;
  if (!operation) return true;
  if (!operation.committing) operation.controller.abort();
  await operation.completion;
  return true;
}
async function _beginRestore(button) {
  _closeDialog();
  await _openImport();
  await Vue.nextTick();
  return _startInstall(button);
}
function _publishPackage(path) {
  const current = _findPackage(path);
  if (current) { current.missing = false; return current; }
  const entry = path === 'restore-stockfish' ? _defaultPackage() : { packagePath: `browser-engines/user/training-${crypto.randomUUID()}/`, name: 'training-engine', source: 'user', files: ['training-engine.js', 'helper.js'] };
  _packages.push(entry);
  return entry;
}
function _usesPackage(profile, path) { return profile.launch.clientType !== 'uci' && profile.launch.entryPath.startsWith(path); }
function _renderDetailsView(route) {
  const path = typeof route.query.packagePath === 'string' ? route.query.packagePath : '';
  const entry = _findPackage(path);
  if (!entry) {
    _renderPage('Package unavailable', 'The requested package folder was not found.', '<p class="ed-form__copy">Return to Engines to refresh or import the files.</p>', _button('Back to engines', 'return-engines'));
    return;
  }
  _renderPage('Browser engine details', entry.name, `<dl class="ed-metadata"><dt>Version</dt><dd>${entry.version ?? 'Not supplied'}</dd><dt>Source</dt><dd>${entry.source === 'bundled' ? 'Included with ChessVue' : 'Imported package'}</dd><dt>Status</dt><dd>${_packageAvailability(entry) || 'Package files available'}</dd><dt>Used by</dt><dd>${_acceptedProfiles.filter((profile) => _usesPackage(profile, path)).map((profile) => _escape(profile.name)).join(', ') || 'No saved profiles'}</dd></dl><p class="ed-form__copy">Package information comes from existing files where available. Entry scripts keep their supplied filenames.</p>`, `${_button('Back to engines', 'return-engines')}${entry.missing ? _button('Reinstall', 'repair', path, 'text-button--primary') : _button('Create profile', 'create-for', path, 'text-button--primary')}`);
}
function _uniqueName(name) {
  let proposed = name;
  let suffix = 2;
  while (_profiles.some((profile) => profile.name === proposed)) proposed = `${name} ${suffix++}`;
  return proposed;
}
function _renderProfileView(route) {
  const profileId = typeof route.params.profileId === 'string' ? route.params.profileId : '';
  const targetPath = typeof route.query.packagePath === 'string' ? route.query.packagePath : '';
  const copy = route.name === 'engine-profile-copy';
  const source = _profiles.find((profile) => profile.id === profileId);
  if (profileId && !source) {
    _renderPage('Profile not found', 'The requested engine profile is unavailable.', '<p class="ed-form__copy">Return to Engines to choose or add a profile.</p>', _button('Back to engines', 'return-engines'));
    return;
  }
  const selectedEntry = targetPath && !targetPath.endsWith('/') ? targetPath : '';
  _editor = { id: source && !copy ? source.id : crypto.randomUUID(), original: !copy ? source : undefined, targets: { uci: source?.launch.clientType === 'uci' ? source.launch.entryPath : '', uciWorker: selectedEntry || (source?.launch.clientType === 'uciWorker' ? source.launch.entryPath : '') } };
  const clientType = targetPath ? 'uciWorker' : source?.launch.clientType ?? (_isBrowser() ? 'uciWorker' : 'uci');
  const name = source ? copy ? _uniqueName(`${source.name} copy`) : source.name : _uniqueName(targetPath ? _packageInfo(targetPath)?.name ?? 'My engine' : 'My engine');
  const typeOptions = `<option value="uci" ${clientType === 'uci' ? 'selected' : ''} ${_isBrowser() ? 'disabled' : ''}>Desktop executable</option><option value="uciWorker" ${clientType === 'uciWorker' ? 'selected' : ''}>Browser UCI Worker</option>`;
  const body = `<form id="profile-form" class="ed-form"><div class="field-row field-row--stack"><label class="field-label" for="profile-name">Profile name</label><input id="profile-name" name="name" class="field-control" value="${_escape(name)}" required></div><div class="field-row field-row--stack"><label class="field-label" for="profile-type">Engine target</label><select id="profile-type" class="field-control">${typeOptions}</select></div><div id="profile-target"></div><div class="ed-option-heading"><h3>Options</h3>${_button('+ Add option', 'add-option')}</div><div id="profile-options" class="ed-options">${(source?.options ?? []).map(_optionRow).join('')}</div><p class="ed-form__copy">Only configured options are sent to the engine. Leave empty to use its defaults.</p><p id="profile-error" class="inline-message inline-message--error" role="alert" hidden></p><p class="ed-form__copy">Apply or Save on Settings to keep this profile. Existing games keep their assigned target and options.</p></form>`;
  _renderPage(source && !copy ? 'Edit engine profile' : 'Add engine profile', _isBrowser() ? 'Choose an entry script from a stored package.' : 'Choose an executable or the entry script inside a browser engine package.', body, `${_button('Cancel', 'return-engines')}<button type="submit" form="profile-form" class="text-button text-button--primary">${source && !copy ? 'Update profile' : 'Add profile'}</button>`, '#profile-name');
  _renderProfileTarget();
}
function _captureTarget() {
  const path = document.querySelector('#profile-path');
  if (path) _editor.targets[path.dataset.clientType] = path.value.trim();
}
function _renderProfileTarget() {
  _captureTarget();
  const clientType = document.querySelector('#profile-type').value;
  const native = clientType === 'uci';
  const label = native ? 'Executable path' : 'Engine entry script';
  const control = !native && _isBrowser() ? _entrySelect() : `<input id="profile-path" data-client-type="${clientType}" class="field-control" value="${_escape(_editor.targets[clientType])}" aria-describedby="target-help" >`;
  const actions = _isBrowser() ? '' : `<div class="ed-actions">${_button(native ? 'Browse executable' : 'Browse entry script', 'browse-target')}${native ? '' : _button('Use included Stockfish', 'use-included')}</div>`;
  document.querySelector('#profile-target').innerHTML = `<div class="ed-form"><div class="field-row field-row--stack"><label class="field-label" for="profile-path">${label}</label>${control}<span id="target-help" class="field-help">${native ? 'The executable stays in its current location.' : _isBrowser() ? 'Choose the actual engine entry. Packages may contain several builds or helper scripts.' : 'Choose the supplied engine script inside its unpacked package. Keep its original files and layout.'}</span></div>${actions}<div id="target-review"></div></div>`;
  _updateTargetReview();
}
function _entrySelect() {
  const currentPath = _editor.targets.uciWorker;
  const unknown = currentPath && !_packageForEntry(currentPath) ? `<option value="${_escape(currentPath)}" selected>Saved entry script &middot; Unavailable</option>` : '';
  const groups = _packages.map((entry) => `<optgroup label="${_escape(entry.name)}">${entry.files.filter((file) => /\.m?js$/i.test(file)).map((file) => `<option value="${_escape(entry.packagePath + file)}" ${entry.packagePath + file === currentPath ? 'selected' : ''}>${_escape(file)}${entry.missing ? ' &middot; Files missing' : ''}</option>`).join('')}</optgroup>`).join('');
  return `<select id="profile-path" class="field-control" data-client-type="uciWorker" aria-describedby="target-help"><option value="">Choose the engine entry script</option>${unknown}${groups}</select>`;
}
function _updateTargetReview() {
  _captureTarget();
  const native = document.querySelector('#profile-type').value === 'uci';
  const entryPath = _editor.targets[native ? 'uci' : 'uciWorker'];
  let message = native ? _isBrowser() ? 'Available in the desktop app.' : entryPath ? 'Executable path selected. No installation is needed.' : 'Choose or paste an executable path.' : '';
  if (!native) {
    const unavailable = _availability({ launch: { clientType: 'uciWorker', entryPath } });
    message = unavailable || 'Entry selected. This path is saved with the profile.';
  }
  document.querySelector('#target-review').innerHTML = `<p class="ed-form__copy" role="status">${message}</p>`;
}
function _optionRow(option = { name: '', value: '' }) {
  return `<div class="ed-option"><input class="field-control" name="option-name" aria-label="Option name" placeholder="Option name" value="${_escape(option.name)}"><input class="field-control" name="option-value" aria-label="Option value" placeholder="Value" value="${_escape(option.value)}"><button type="button" class="icon-button" data-action="remove-option" aria-label="Remove option">&times;</button></div>`;
}
async function _saveProfile(event) {
  event.preventDefault();
  _captureTarget();
  const form = event.target;
  const name = form.elements.name.value.trim();
  const clientType = document.querySelector('#profile-type').value;
  const launch = { clientType, entryPath: _editor.targets[clientType] };
  const error = !name ? 'Enter a profile name.' : _profiles.some((profile) => profile.id !== _editor.original?.id && profile.name === name) ? 'A profile with this name already exists. Choose another name.' : '';
  if (error) {
    const message = document.querySelector('#profile-error');
    message.textContent = error;
    message.hidden = false;
    form.elements.name.focus();
    return;
  }
  const options = [...form.querySelectorAll('.ed-option')].map((row) => ({ name: row.querySelector('[name="option-name"]').value.trim(), value: row.querySelector('[name="option-value"]').value })).filter((option) => option.name);
  const profile = { id: _editor.id, name, launch, options };
  const index = _profiles.findIndex((candidate) => candidate.id === _editor.original?.id);
  if (index < 0) _profiles.push(profile);
  else _profiles.splice(index, 1, profile);
  _render();
  await _returnToEngines(true);
  _notify('Profile added to your changes. Apply or Save to keep it. Engine files stay in place.');
}
function _removePackage(path) {
  const accepted = _acceptedProfiles.filter((profile) => _usesPackage(profile, path));
  const drafts = _profiles.filter((profile) => _usesPackage(profile, path) && !accepted.some((saved) => saved.id === profile.id));
  const usage = accepted.map((profile) => `<li><strong>${_escape(profile.name)}</strong><small>${_profiles.some((candidate) => candidate.id === profile.id) ? 'Saved profile' : 'Profile deletion has not been applied'}</small></li>`).join('') + drafts.map((profile) => `<li><strong>${_escape(profile.name)}</strong><small>Unsaved profile</small></li>`).join('') + (path === _defaultPath ? '<li><strong>Opening study</strong><small>Open game &middot; Analysis engine</small></li>' : '');
  if (usage) {
    _showDialog('Engine is still in use', _findPackage(path).name, `<p class="ed-form__copy">Keep this browser package until these references have been removed. Apply profile deletions before trying again.</p><ul class="ed-usage">${usage}</ul>`, `${_button('Close', 'close')}${_button('Show profiles', 'show-profiles', '', 'text-button--primary')}`);
    return;
  }
  _showDialog('Remove browser engine?', _findPackage(path).name, '<p class="ed-form__copy">Remove the package files stored in this browser. Closed games may need the same package imported again.</p>', `${_button('Keep engine', 'close')}${_button('Remove engine', 'confirm-remove', path, 'text-button--danger')}`);
}
function _showAnalysis() {
  const choices = _acceptedProfiles.map((profile) => {
    const reason = _availability(profile);
    return `<label class="ed-choice"><input type="radio" name="analysis-profile" value="${profile.id}" aria-describedby="reason-${profile.id}"><span><strong>${_escape(profile.name)}</strong><small>${_targetSummary(profile)}</small><small id="reason-${profile.id}">${reason || 'Saved engine profile'}</small></span></label>`;
  }).join('');
  _showDialog('Add analysis engine', 'Choose a saved profile for this game.', choices || '<p class="ed-form__copy">Create a profile in Settings and Apply your changes first.</p>', `${_button('Cancel', 'close')}<button id="assign-confirm" type="button" class="text-button text-button--primary" data-action="assign" disabled>Add engine</button>`);
}
function _acceptSettings(save) {
  _acceptedProfiles = structuredClone(_profiles);
  _acceptedResumeAnalysis = _resumeAnalysis;
  _render();
  _notify(save ? 'Settings saved. This preview stays here so you can keep reviewing.' : 'Settings applied. Saved profiles are now available in the Analysis chooser.');
}
function _cancelSettings() {
  if (!_dirty()) { _notify('No unsaved profile or behaviour changes.'); return; }
  _showDialog('Discard settings changes?', 'Your profile and behaviour changes have not been applied.', '<p class="ed-form__copy">Completed browser engine imports will remain installed. Desktop engine files are not changed.</p>', `${_button('Keep editing', 'close')}${_button('Discard changes', 'discard', '', 'text-button--danger')}`);
}
function _trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const controls = [..._dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length);
  if (!controls.length) { event.preventDefault(); return; }
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function _dispatch(action, button) {
  const id = button.dataset.id;
  const actions = {
    install: () => _openImport(), 'choose-package': () => _choosePackage(id), 'start-install': () => id === 'restore-stockfish' ? _beginRestore(button) : _startInstall(button),
    'add-profile': () => _openProfile(), 'create-for': () => _openProfile('', id), 'edit-profile': () => _openProfile(id), 'copy-profile': () => _openProfile(id, '', true),
    'delete-profile': () => { _profiles = _profiles.filter((profile) => profile.id !== id); _render(); _notify('Profile deleted from your changes. Engine files stay in place; Apply or Save to keep this change.'); },
    'browse-target': () => { document.querySelector('#profile-path').value = document.querySelector('#profile-type').value === 'uci' ? 'C:\\Engines\\chosen-engine.exe' : 'D:\\Chess\\Engines\\training-engine\\training-engine.js'; _updateTargetReview(); },
    'use-included': () => { document.querySelector('#profile-path').value = _defaultPath + _defaultEntry; _updateTargetReview(); },
    'add-option': () => { document.querySelector('#profile-options').insertAdjacentHTML('beforeend', _optionRow()); document.querySelector('#profile-options .ed-option:last-child input').focus(); },
    'remove-option': () => button.closest('.ed-option').remove(),
    'remove-package': () => _removePackage(id), 'confirm-remove': () => { _packages = _packages.filter((entry) => entry.packagePath !== id); _render(); _closeDialog(); _notify('Browser package removed. The storage change is already saved.'); },
    details: () => _openDetails(id), repair: () => _openImport(id), restore: () => _showRestore(), close: () => _closeDialog(), 'return-engines': () => _returnToEngines(),
    'show-profiles': () => { _closeDialog(); document.querySelector('#profiles-title').scrollIntoView({ block: 'center' }); document.querySelector('#profiles-title').focus(); },
    analysis: () => _showAnalysis(), assign: () => { _closeDialog(); _notify('The selected saved profile would now be copied into this game.'); },
    apply: () => _acceptSettings(false), save: () => _acceptSettings(true), 'cancel-settings': () => _cancelSettings(),
    discard: () => { _profiles = structuredClone(_acceptedProfiles); _resumeAnalysis = _acceptedResumeAnalysis; _render(); _closeDialog(); _notify('Unsaved changes discarded. Completed browser imports remain installed.'); },
    'reset-preview': () => _resetPreview(),
  };
  actions[action]?.();
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  if (!_dialog.open) { _opener = button; _openerAction = { action: button.dataset.action, id: button.dataset.id }; }
  _dispatch(button.dataset.action, button);
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'preview-theme') document.documentElement.dataset.themeMode = event.target.value;
  if (event.target.id === 'preview-host') _resetPreview();
  if (event.target.id === 'preview-state') _resetPreview();
  if (event.target.id === 'resume-analysis') { _resumeAnalysis = event.target.checked; _render(); }
  if (event.target.id === 'profile-type') _renderProfileTarget();
  if (event.target.id === 'profile-path') _updateTargetReview();
  if (event.target.name === 'analysis-profile') document.querySelector('#assign-confirm').disabled = false;
});
_dialog.addEventListener('cancel', (event) => { event.preventDefault(); _closeDialog(); });
_dialog.addEventListener('click', (event) => { if (event.target === _dialog) _closeDialog(); });
document.querySelector('#engine-route-view').addEventListener('submit', (event) => { if (event.target.id === 'profile-form') void _saveProfile(event); });
_dialog.addEventListener('keydown', _trapDialogFocus);
_resetPreview();
const EngineOverviewView = {
  name: 'EngineOverviewView',
  template: document.querySelector('#engine-overview-template').innerHTML,
  setup() { Vue.onMounted(_mountOverview); },
};
const EngineProfileView = {
  name: 'EngineProfileView',
  template: '<section class="ed-content" data-engine-route="profile"><div class="ed-engine-view" aria-labelledby="engine-view-title"></div></section>',
  setup() {
    const route = VueRouter.useRoute();
    Vue.onMounted(() => _renderProfileView(route));
    Vue.onBeforeUnmount(() => { _editor = undefined; });
  },
};
const EnginePackageImportView = {
  name: 'EnginePackageImportView',
  template: '<section class="ed-content" data-engine-route="import"><div class="ed-engine-view" aria-labelledby="engine-view-title"></div></section>',
  setup() {
    const route = VueRouter.useRoute();
    Vue.onMounted(() => _renderImportView(route));
    VueRouter.onBeforeRouteLeave(_settleImportBeforeLeave);
    VueRouter.onBeforeRouteUpdate(_settleImportBeforeLeave);
  },
};
const EnginePackageDetailsView = {
  name: 'EnginePackageDetailsView',
  template: '<section class="ed-content" data-engine-route="details"><div class="ed-engine-view" aria-labelledby="engine-view-title"></div></section>',
  setup() {
    const route = VueRouter.useRoute();
    Vue.onMounted(() => _renderDetailsView(route));
  },
};
_router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path: '/settings/engines', name: 'engine-overview', component: EngineOverviewView },
    { path: '/settings/engines/profiles/new', name: 'engine-profile-new', component: EngineProfileView },
    { path: '/settings/engines/profiles/:profileId/edit', name: 'engine-profile-edit', component: EngineProfileView },
    { path: '/settings/engines/profiles/:profileId/copy', name: 'engine-profile-copy', component: EngineProfileView },
    { path: '/settings/engines/packages/import', name: 'engine-package-import', component: EnginePackageImportView },
    { path: '/settings/engines/packages/details', name: 'engine-package-details', component: EnginePackageDetailsView },
    { path: '/:pathMatch(.*)*', redirect: '/settings/engines' },
  ],
});
Vue.createApp({ template: '<RouterView v-slot="{ Component, route }"><component :is="Component" :key="route.fullPath" /></RouterView>' }).use(_router).mount('#engine-route-view');
