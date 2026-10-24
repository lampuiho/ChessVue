'use strict';
const _dialog = document.querySelector('#engine-dialog');
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
  return { packagePath: path, name: 'Training engine', version: '1.0', source: 'user' };
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
  return `<article class="ed-row"><span class="ed-mark" aria-hidden="true">&#9822;</span><div class="ed-row__copy"><div class="ed-row__title"><h3>${_escape(entry.name)}</h3>${entry.source === 'bundled' ? _tag('Included with ChessVue') : ''}${_tag(unavailable ? 'Files missing' : 'Ready', unavailable ? 'error' : 'ready')}</div><p>${_escape(entry.version)} &middot; ${unavailable || 'Computer play and analysis'}</p></div><div class="ed-row__actions">${actions}${_button('Details', 'details', entry.packagePath)}${_button('Remove', 'remove-package', entry.packagePath, 'text-button--ghost')}</div></article>`;
}
function _renderProfile(profile) {
  const unavailable = _availability(profile);
  const options = profile.options.map((option) => `${_escape(option.name)} ${_escape(option.value)}`).join(' &middot; ') || 'Default engine options';
  return `<article class="ed-row"><span class="ed-mark" aria-hidden="true">&#9822;</span><div class="ed-row__copy"><div class="ed-row__title"><h3>${_escape(profile.name)}</h3>${unavailable ? _tag('Unavailable', 'warning') : ''}</div><p>${_targetSummary(profile)}</p><p>${unavailable || options}</p></div><div class="ed-row__actions">${_button('Copy', 'copy-profile', profile.id)}${_button('Edit', 'edit-profile', profile.id)}${_button('Delete', 'delete-profile', profile.id, 'text-button--ghost')}</div></article>`;
}
function _render() {
  document.querySelector('#packages-section').hidden = !_isBrowser();
  document.querySelector('#installed-engines').innerHTML = _packages.map(_renderPackage).join('') || '<div class="ed-empty"><h3>No browser engines installed</h3><p>Import a package, then create a profile to choose it in a game.</p></div>';
  document.querySelector('#engine-profiles').innerHTML = _profiles.map(_renderProfile).join('') || `<div class="ed-empty"><h3>No engine profiles</h3><p>${_isBrowser() ? 'Create a profile from an imported package.' : 'Add a profile pointing to an executable or package folder.'}</p></div>`;
  document.querySelector('#restore-default').hidden = _packages.some((entry) => entry.source === 'bundled');
  document.querySelector('#profile-help').textContent = _isBrowser() ? 'Reusable names and options for games. Apply or Save to keep profile changes.' : 'Names, executable or package paths, and options for games. Apply or Save to keep changes.';
  document.querySelector('#unsaved').hidden = !_dirty();
  document.querySelector('#apply-settings').disabled = !_dirty();
  document.querySelector('#save-settings').disabled = !_dirty();
  document.querySelector('#draft-summary').textContent = _dirty() ? 'Profile and behaviour changes are not saved yet' : 'All profile changes saved';
  document.querySelector('#resume-analysis').checked = _resumeAnalysis;
}
function _resetPreview() {
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
  if (_installOperation && !_installOperation.committing) _installOperation.controller.abort();
  if (_installOperation?.committing) return;
  _dialog.close();
  _editor = undefined;
  const survivingOpener = _opener?.isConnected ? _opener : [...document.querySelectorAll('[data-action]')].find((button) => button.dataset.action === _openerAction?.action && button.dataset.id === _openerAction?.id);
  (survivingOpener ?? document.querySelector('.ed-page-title')).focus();
}
function _showRestore() {
  _showDialog('Restore included engine', 'Stockfish is available from the package included with ChessVue.', '<dl class="ed-metadata"><dt>Engine</dt><dd>Stockfish 19</dd><dt>Version</dt><dd>19.0.1</dd><dt>Source</dt><dd>Included with ChessVue</dd></dl><p class="ed-form__copy">Restore this package in browser storage. Existing profiles keep their saved paths and options.</p>', `${_button('Cancel', 'close')}${_button('Restore engine', 'start-install', 'restore-stockfish', 'text-button--primary')}`);
}
function _showInstall(repairPath = '') {
  if (!_isBrowser()) return;
  const file = `<div class="ed-file"><div><strong>Choose a browser engine package</strong><small>Choose the engine archive. Its original files and layout are preserved.</small></div>${_button('Choose package', 'choose-package', repairPath)}</div>`;
  _showDialog(repairPath ? 'Reinstall browser engine' : 'Install browser engine', 'Package imports take effect immediately. Profiles are saved separately.', `${file}<div id="package-review"></div>`, `${_button('Cancel', 'close')}<button id="install-confirm" type="button" class="text-button text-button--primary" data-action="start-install" data-id="${_escape(repairPath)}" disabled>Install engine</button>`, '[data-action="choose-package"]');
}
function _choosePackage(repairPath) {
  const entry = _findPackage(repairPath);
  const review = document.querySelector('#package-review');
  if (document.querySelector('#preview-state').value === 'incompatible') {
    review.innerHTML = '<p class="inline-message inline-message--error" role="alert">This package needs an engine interface that this version of ChessVue does not support. Choose another package.</p>';
    return;
  }
  const files = entry?.files ?? ['training-engine.js', 'helper.js'];
  const choices = files.filter((file) => /\.m?js$/i.test(file)).map((file) => `<option value="${_escape(file)}">${_escape(file)}</option>`).join('');
  review.innerHTML = `<div class="ed-form"><dl class="ed-metadata"><dt>Selected file</dt><dd>${repairPath ? 'stockfish-19' : 'training-engine'}.zip</dd><dt>Package</dt><dd>${_escape(entry?.name ?? 'Training engine')}</dd><dt>Version</dt><dd>${_escape(entry?.version ?? '1.0')}</dd><dt>Interface</dt><dd>Browser UCI Worker</dd></dl><div class="field-row field-row--stack"><label class="field-label" for="package-entry">Entry script to check</label><select id="package-entry" class="field-control"><option value="">Choose the engine entry script</option>${choices}</select><span class="field-help">Choose the engine entry, rather than a helper script. No standard filename or new manifest is required.</span></div><p class="ed-form__copy">ChessVue will check this entry before saving the original package files in this browser.</p></div>`;
  document.querySelector('#install-confirm').disabled = true;
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
  const labels = ['Reading package files', 'Checking engine compatibility', 'Finishing installation'];
  const body = `<div role="status" aria-live="polite">${labels.map((label, index) => `<div class="ed-stage ${index < stage ? 'ed-stage--done' : index === stage ? 'ed-stage--active' : ''}"><span class="ed-stage__number">${index < stage ? '&#10003;' : index + 1}</span>${label}</div>`).join('')}</div><p class="ed-form__copy">${stage < 2 ? 'You can cancel while ChessVue checks the package.' : 'Finishing the import into browser storage. This window will be available again shortly.'}</p>`;
  _showDialog('Installing browser engine', 'The package becomes available after all checks finish.', body, stage < 2 ? _button('Cancel installation', 'close') : '<button type="button" class="text-button" disabled>Finishing...</button>');
  _dialog.querySelector('[data-action="close"]').disabled = stage === 2;
}
async function _startInstall(button) {
  if (_installOperation || !_isBrowser()) return;
  const entryFile = button.dataset.id === 'restore-stockfish' ? _defaultEntry : document.querySelector('#package-entry')?.value;
  if (!entryFile) return;
  const operation = { controller: new AbortController(), committing: false };
  _installOperation = operation;
  const signal = operation.controller.signal;
  try {
    _renderProgress(0);
    await _delay(signal, 350);
    _renderProgress(1);
    await _delay(signal, 1200);
    operation.committing = true;
    _renderProgress(2);
    await _delay(signal, 350);
    const entry = _publishPackage(button.dataset.id);
    _render();
    _showDialog('Browser engine installed', 'The original package files are saved in this browser.', `<div class="ed-success"><h3>&#10003; ${_escape(entry.name)} is ready</h3><p>Computer play and analysis in this simulated preview.</p></div><p class="ed-form__copy">Create a profile using ${_escape(entryFile)}, or choose an entry later. The package contains no generated loading manifest.</p>`, `${_button('Done', 'close')}${_button('Create profile', 'create-for', entry.packagePath + entryFile, 'text-button--primary')}`);
  } catch (error) {
    if (!signal.aborted) _notify(`Installation could not finish: ${_escape(error.message)}`);
  } finally { _installOperation = undefined; }
}
function _publishPackage(path) {
  const current = _findPackage(path);
  if (current) { current.missing = false; return current; }
  const entry = path === 'restore-stockfish' ? _defaultPackage() : { packagePath: `browser-engines/user/training-${crypto.randomUUID()}/`, name: 'Training engine', version: '1.0', source: 'user', files: ['training-engine.js', 'helper.js'] };
  _packages.push(entry);
  return entry;
}
function _usesPackage(profile, path) { return profile.launch.clientType !== 'uci' && profile.launch.entryPath.startsWith(path); }
function _showDetails(path) {
  const entry = _findPackage(path);
  _showDialog('Browser engine details', entry.name, `<dl class="ed-metadata"><dt>Version</dt><dd>${entry.version}</dd><dt>Source</dt><dd>${entry.source === 'bundled' ? 'Included with ChessVue' : 'Imported package'}</dd><dt>Status</dt><dd>${_packageAvailability(entry) || 'Ready for computer play and analysis'}</dd><dt>Used by</dt><dd>${_acceptedProfiles.filter((profile) => _usesPackage(profile, path)).map((profile) => _escape(profile.name)).join(', ') || 'No saved profiles'}</dd></dl><p class="ed-form__copy">Package information comes from existing files where available. Entry scripts keep their supplied filenames.</p>`, `${_button('Close', 'close')}${entry.missing ? _button('Reinstall', 'repair', path, 'text-button--primary') : _button('Create profile', 'create-for', path, 'text-button--primary')}`);
}
function _uniqueName(name) {
  let proposed = name;
  let suffix = 2;
  while (_profiles.some((profile) => profile.name === proposed)) proposed = `${name} ${suffix++}`;
  return proposed;
}
function _showProfile(profileId = '', packagePath = '', copy = false) {
  const source = _profiles.find((profile) => profile.id === profileId);
  if (_isBrowser() && !source && !_packages.some((entry) => !_packageAvailability(entry))) {
    _showDialog('Add engine profile', 'Install a browser engine first.', '<p class="ed-form__copy">This browser needs a stored engine package before you can create a new profile.</p>', `${_button('Cancel', 'close')}${_button('Install browser engine', 'install', '', 'text-button--primary')}`);
    return;
  }
  _editor = { id: source && !copy ? source.id : crypto.randomUUID(), original: !copy ? source : undefined, executablePath: source?.launch.executablePath ?? '', packagePath: packagePath || source?.launch.packagePath || (_isBrowser() ? _packages.find((entry) => !entry.missing)?.packagePath : _defaultPath) || '' };
  const clientType = packagePath ? 'uciWorker' : source?.launch.clientType ?? (_isBrowser() ? 'uciWorker' : 'uci');
  const name = source ? copy ? _uniqueName(`${source.name} copy`) : source.name : _uniqueName(packagePath ? _packageInfo(packagePath).name : 'My engine');
  const typeOptions = `<option value="uci" ${clientType === 'uci' ? 'selected' : ''} ${_isBrowser() ? 'disabled' : ''}>Desktop executable</option><option value="uciWorker" ${clientType === 'uciWorker' ? 'selected' : ''}>Browser package</option>`;
  const body = `<form id="profile-form" class="ed-form"><div class="field-row field-row--stack"><label class="field-label" for="profile-name">Profile name</label><input id="profile-name" name="name" class="field-control" value="${_escape(name)}" required></div><div class="field-row field-row--stack"><label class="field-label" for="profile-type">Engine target</label><select id="profile-type" class="field-control">${typeOptions}</select></div><div id="profile-target"></div><div class="ed-option-heading"><h3>Options</h3>${_button('+ Add option', 'add-option')}</div><div id="profile-options" class="ed-options">${(source?.options ?? []).map(_optionRow).join('')}</div><p class="ed-form__copy">Only configured options are sent to the engine. Leave empty to use its defaults.</p><p id="profile-error" class="inline-message inline-message--error" role="alert" hidden></p><p class="ed-form__copy">Apply or Save on Settings to keep this profile. Existing games keep their assigned target and options.</p></form>`;
  _showDialog(source && !copy ? 'Edit engine profile' : 'Add engine profile', _isBrowser() ? 'Choose a stored package and name this configuration.' : 'Choose an executable or a browser engine package folder.', body, `${_button('Cancel', 'close')}<button type="submit" form="profile-form" class="text-button text-button--primary">${source && !copy ? 'Update profile' : 'Add profile'}</button>`, '#profile-name');
  _renderProfileTarget();
}
function _captureTarget() {
  const path = document.querySelector('#profile-path');
  if (path) _editor[path.dataset.target] = path.value.trim();
}
function _renderProfileTarget() {
  _captureTarget();
  const native = document.querySelector('#profile-type').value === 'uci';
  const label = native ? 'Executable path' : _isBrowser() ? 'Installed browser engine' : 'Package folder';
  const target = native ? 'executablePath' : 'packagePath';
  const control = !native && _isBrowser() ? _packageSelect() : `<input id="profile-path" data-target="${target}" class="field-control" value="${_escape(_editor[target])}" aria-describedby="target-help">`;
  const actions = _isBrowser() ? '' : `<div class="ed-actions">${_button(native ? 'Browse executable' : 'Browse folder', 'browse-target')}${native ? '' : _button('Use included Stockfish', 'use-included')}</div>`;
  document.querySelector('#profile-target').innerHTML = `<div class="ed-form"><div class="field-row field-row--stack"><label class="field-label" for="profile-path">${label}</label>${control}<span id="target-help" class="field-help">${native ? 'The executable stays in its current location.' : _isBrowser() ? 'Several profiles can share one stored package.' : 'Choose an unpacked folder containing engine.json and worker.js. Files stay in place.'}</span></div>${actions}<div id="target-review"></div></div>`;
  _updateTargetReview();
}
function _packageSelect() {
  const currentPath = _editor.packagePath;
  const unknown = currentPath && !_findPackage(currentPath) ? `<option value="${_escape(currentPath)}" selected>Saved package folder &middot; Unavailable</option>` : '';
  return `<select id="profile-path" class="field-control" data-target="packagePath" aria-describedby="target-help">${unknown}${_packages.map((entry) => `<option value="${_escape(entry.packagePath)}" ${entry.packagePath === currentPath ? 'selected' : ''}>${_escape(entry.name)}${entry.missing ? ' &middot; Files missing' : ''}</option>`).join('')}</select>`;
}
function _updateTargetReview() {
  _captureTarget();
  const native = document.querySelector('#profile-type').value === 'uci';
  let message = native ? _isBrowser() ? 'Available in the desktop app.' : _editor.executablePath ? 'Executable path selected. No installation is needed.' : 'Choose or paste an executable path.' : '';
  if (!native) {
    const entry = _packageInfo(_editor.packagePath);
    message = document.querySelector('#preview-state').value === 'incompatible' ? 'This package uses an unsupported engine interface. Choose another package.' : _packageAvailability(entry) || `${_escape(entry.name)} &middot; ${_escape(entry.version)} &middot; Ready`;
  }
  document.querySelector('#target-review').innerHTML = `<p class="ed-form__copy" role="status">${message}</p>`;
}
function _optionRow(option = { name: '', value: '' }) {
  return `<div class="ed-option"><input class="field-control" name="option-name" aria-label="Option name" placeholder="Option name" value="${_escape(option.name)}"><input class="field-control" name="option-value" aria-label="Option value" placeholder="Value" value="${_escape(option.value)}"><button type="button" class="icon-button" data-action="remove-option" aria-label="Remove option">&times;</button></div>`;
}
function _saveProfile(event) {
  event.preventDefault();
  _captureTarget();
  const form = event.target;
  const name = form.elements.name.value.trim();
  const clientType = document.querySelector('#profile-type').value;
  const launch = clientType === 'uci' ? { clientType, executablePath: _editor.executablePath } : { clientType, packagePath: _editor.packagePath };
  const unchangedTarget = JSON.stringify(launch) === JSON.stringify(_editor.original?.launch);
  let error = !name ? 'Enter a profile name.' : _profiles.some((profile) => profile.id !== _editor.original?.id && profile.name === name) ? 'A profile with this name already exists. Choose another name.' : '';
  if (!error && !unchangedTarget) error = _availability({ launch });
  if (!error && clientType !== 'uci' && document.querySelector('#preview-state').value === 'incompatible' && !unchangedTarget) error = 'Choose a package with a supported engine interface.';
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
  _closeDialog();
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
    return `<label class="ed-choice ${reason ? 'ed-choice--disabled' : ''}"><input type="radio" name="analysis-profile" value="${profile.id}" ${reason ? 'disabled' : ''} aria-describedby="reason-${profile.id}"><span><strong>${_escape(profile.name)}</strong><small>${_targetSummary(profile)}</small><small id="reason-${profile.id}">${reason || 'Available for analysis'}</small></span></label>`;
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
    install: () => _showInstall(), 'choose-package': () => _choosePackage(id), 'start-install': () => _startInstall(button),
    'add-profile': () => _showProfile(), 'create-for': () => _showProfile('', id), 'edit-profile': () => _showProfile(id), 'copy-profile': () => _showProfile(id, '', true),
    'delete-profile': () => { _profiles = _profiles.filter((profile) => profile.id !== id); _render(); _notify('Profile deleted from your changes. Engine files stay in place; Apply or Save to keep this change.'); },
    'browse-target': () => { document.querySelector('#profile-path').value = document.querySelector('#profile-type').value === 'uci' ? 'C:\\Engines\\chosen-engine.exe' : 'D:\\Chess\\Engines\\training-engine'; _updateTargetReview(); },
    'use-included': () => { document.querySelector('#profile-path').value = _defaultPath; _updateTargetReview(); },
    'add-option': () => { document.querySelector('#profile-options').insertAdjacentHTML('beforeend', _optionRow()); document.querySelector('#profile-options .ed-option:last-child input').focus(); },
    'remove-option': () => button.closest('.ed-option').remove(),
    'remove-package': () => _removePackage(id), 'confirm-remove': () => { _packages = _packages.filter((entry) => entry.packagePath !== id); _render(); _closeDialog(); _notify('Browser package removed. The storage change is already saved.'); },
    details: () => _showDetails(id), repair: () => _showInstall(id), restore: () => _showRestore(), close: () => _closeDialog(),
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
  if (event.target.id === 'preview-host') _render();
  if (event.target.id === 'preview-state') _resetPreview();
  if (event.target.id === 'resume-analysis') { _resumeAnalysis = event.target.checked; _render(); }
  if (event.target.id === 'profile-type') _renderProfileTarget();
  if (event.target.id === 'profile-path') _updateTargetReview();
  if (event.target.name === 'analysis-profile') document.querySelector('#assign-confirm').disabled = false;
});
_dialog.addEventListener('cancel', (event) => { event.preventDefault(); _closeDialog(); });
_dialog.addEventListener('click', (event) => { if (event.target === _dialog) _closeDialog(); });
_dialog.addEventListener('submit', (event) => { if (event.target.id === 'profile-form') _saveProfile(event); });
_dialog.addEventListener('keydown', _trapDialogFocus);
_resetPreview();
