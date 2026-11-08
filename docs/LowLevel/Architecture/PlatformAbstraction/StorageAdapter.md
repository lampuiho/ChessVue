# StorageAdapter

## Purpose
Handle generic host storage plus generic file-system and file-dialog operations through one platform contract.

`IStorageAdapter` is path-based and rootless. It operates only on explicit paths supplied by callers and does not own save-root, settings-path or engine-path policy.

## Public Interface
```ts
// src/contracts/platform/IFileSystemEntry.ts
interface IFileSystemEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  lastModifiedUtc?: SaveTimestamp;
}

// src/contracts/platform/IWriteTextFileOptions.ts
interface IWriteTextFileOptions {
  overwrite?: boolean;
  ensureParentDirectory?: boolean;
}

// src/contracts/platform/IStorageAdapter.ts
interface IStorageAdapter {
  showSaveDialog(suggestedPath?: string): Promise<string>;
  showOpenDialog(startDirectory?: string): Promise<string>;
  listDirectory(path: string): Promise<IFileSystemEntry[]>;
  ensureDirectory(path: string): Promise<void>;
  writeTextFile(path: string, raw: string, options?: IWriteTextFileOptions): Promise<void>;
  readTextFile(path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
}
```

`lastModifiedUtc` is a hydrated `SaveTimestamp` for files and is absent for directories. `SavedGameIndexService` uses it as the save time of a managed save.

## Responsibilities
- show host save and open dialogs and return the selected paths
- enumerate directories, create folders when requested, and read or write raw text documents at caller-provided paths
- delete caller-provided files when the owning layer has already decided that removal is required
- avoid owning any implicit storage root; layer-2 services resolve managed save roots and build-config paths
- report failures through the shared `IPlatformError` contract

## Dependencies
- NW.js: file inputs carrying NW.js dialog attributes, and Node `fs`/`path` resolved through `NodeUtility`
- Browser: `Storage` (`localStorage` by default), file inputs, `FileReader`, `Blob` downloads and `crypto.randomUUID()`
- shared platform failure contract from [PlatformError](../DataInterface/PlatformError.md)

## Failure Semantics
- `showSaveDialog` and `showOpenDialog` reject with `cancelled` when the user dismisses the dialog without choosing a path.
- `listDirectory` rejects with `notFound` when the path does not exist and `permissionDenied` when it cannot be enumerated.
- `ensureDirectory` rejects with `permissionDenied` when the directory cannot be created. The browser implementation rejects with `invalidOperation` when a file already occupies a path segment.
- `writeTextFile` rejects with `alreadyExists` when the file exists and `overwrite` is not `true`. NW.js non-overwrite writes use exclusive creation (`wx`). **Why:** an existence check followed by a write could silently overwrite a file created by an external writer in between.
- `writeTextFile` creates the parent directory only when `ensureParentDirectory` is `true`; otherwise a missing parent is a write failure (`notFound`). It rejects with `permissionDenied` when the destination cannot be written. The browser implementation rejects with `invalidOperation` when the target path is a directory.
- `readTextFile` rejects with `notFound` or `permissionDenied` when the host cannot reopen the path, and with `invalidDocument` when the bytes are not valid UTF-8 text.
- `deleteFile` rejects with `notFound` or `permissionDenied` when the host cannot remove the path.
- Readable-but-invalid payloads are not repaired here. Layer-2 services pass loaded text through `SerializationService` or the settings schema for schema-version and corruption decisions.

## NW.js Implementation
`defineNwjsStorageAdapterStore(nw)` in `src/platform/nwjs/NwjsStorageAdapter.ts` defines the `nwjsStorageAdapter` Pinia store used by the NW.js platform store.

- Dialogs create a hidden file input. Save sets `nwsaveas` to the suggested file name and `nwworkingdir` to its directory; open sets `nwworkingdir` to the start directory. The selected `File.path` (or input value) is returned with forward slashes; an empty selection or the input's `cancel` event rejects with `cancelled`.
- File operations use `fs.promises`. Node error codes map to platform kinds: `EEXIST` to `alreadyExists`, `ENOENT` to `notFound`, `EACCES`/`EPERM` to `permissionDenied`, and anything else to `invalidDocument` with the Node message as detail.
- `listDirectory` stats each file for its modification time and returns forward-slash paths.
- `readTextFile` decodes with a fatal UTF-8 `TextDecoder`, so malformed bytes become `invalidDocument` rather than replacement characters.
- Relative paths, such as the default `saves` root and the build-config settings paths, resolve against the NW.js process working directory.

## Browser Implementation
`defineBrowserStorageAdapterStore(storage?, storageKey?)` in `src/platform/browser/BrowserStorageAdapter.ts` defines the `browserStorageAdapter` Pinia store. Managed files are delegated to `BrowserFileSystem`; dialogs use transient tokens.

### Managed files
`BrowserFileSystem` (`src/platform/browser/BrowserFileSystem.ts`) keeps one JSON index under a single storage key, `chessvue:files:v1` by default, containing virtual directories and files with their raw text and modification time.

- Paths are normalised by `normaliseBrowserPath(...)`: backslashes become slashes, `.` and `..` segments resolve, and the root is `.`.
- Every operation reads and validates the current index before acting, and writes the whole index back. **Why:** caching a snapshot per adapter instance would let one instance overwrite another's newer changes; reading each time keeps the stored index authoritative.
- An unreadable store maps to `permissionDenied`, an index that fails its schema to `invalidDocument`, and a failed `setItem` (for example a quota failure) to `permissionDenied`.
- A write records a modification time no earlier than now and strictly later than every existing file. **Why:** saves written within the same millisecond would otherwise tie, and latest-save selection orders managed saves by this timestamp.
- `listDirectory` returns direct child directories and files sorted by name. Files carry `lastModifiedUtc` as a `SaveTimestamp`.
- The class also exposes `listFiles()` and `readFile(path)` for journey tooling. Application code reaches it only through the adapter.

### Import and export
- `showOpenDialog()` opens a hidden `.json` file input, reads the chosen `File` as fatal UTF-8 text and returns an opaque `browser-import:<uuid>/<name>` token. The following `readTextFile(token)` returns that text once and consumes the token. Cancellation rejects with `cancelled`; a read failure with `permissionDenied`; invalid UTF-8 with `invalidDocument`.
- `showSaveDialog(suggestedPath = 'game.json')` returns an opaque `browser-download:<uuid>/<name>` token using only the suggested file name. The following `writeTextFile(token, raw)` downloads the JSON document and consumes the token. Downloads follow the browser's own save preferences.
- Browser pickers cannot honour a desktop start directory or suggested folder.
- **Why tokens:** `SerializationService` owns a path-shaped select-then-read or select-then-write flow. Returning tokens lets browser import and download satisfy that unchanged contract without exposing `File` objects or download APIs above layer 1.

### Journey bootstrap
`setBrowserPlatformOptions(...)` passes isolated `sessionStorage` and a run-specific key into this store. Journey tooling replaces only the two dialog functions with deterministic virtual import and export paths; managed-file behaviour uses the same `BrowserFileSystem` implementation.

## Notes
- The adapter remains rootless and path-based on both hosts.
- `BuildConfig.persistence` supplies the settings, game-session and layout file paths; `gameSession.saveRootPath` supplies the managed save root. In the browser these are virtual paths inside the file index.
- Engine package bytes are not stored through this adapter. `EnginePackageService` uses the separate IndexedDB store owned by `WorkerScriptLoader`.
