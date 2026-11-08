# EnginePackageService

## Purpose
Own engine-folder discovery, ZIP validation and browser package import and removal. Desktop profiles keep direct executable or script paths, so the desktop has no managed engine store; the bundled Stockfish folder is listed on both hosts alongside any imported folders.

## Public Interface
```ts
// src/domain/EnginePackageService.ts (imported directly; not re-exported by src/domain/index.ts)
canInstall(): boolean;
listPackages(): Promise<readonly IEnginePackage[]>;
browseEngineFile(startDirectory?: string): Promise<string>;
readArchive(file: IEnginePackageFile, signal?: AbortSignal): Promise<IEngineArchive>;
install(engineName: string, archive: IEngineArchive, signal?: AbortSignal): Promise<string>;
remove(packagePath: string, references: readonly IEnginePackageUsage[]): Promise<void>;
```

## Responsibilities
- report whether managed package writes are available on this host
- list the bundled folder and imported package folders with their file names
- open the existing file dialog so a desktop profile can select an executable or entry script
- decode and validate a ZIP archive without writing storage or choosing an entry
- write an imported package atomically under its validated engine name
- refuse removal of a package still referenced by profiles or open games, then delete it atomically

## Dependencies
- a module-level, storage-only `WorkerScriptLoader(EnginePackageConfig)` for IndexedDB file operations
- `StockfishConfig` for the bundled package definition
- `getPlatformTarget()` for the host capability
- `IStorageAdapter.showOpenDialog` through `usePlatformService()`, resolved only when `browseEngineFile` runs
- `fflate` for ZIP decoding

## Caller
`EnginesStore` is the only caller. It queues package discovery, import and removal so a refresh cannot publish a list read before an issued mutation has settled, and it rediscovers after a successful import or removal.

## Notes
- `canInstall()` is `true` only for the browser target. It does not probe storage health or permissions. `install` and `remove` reject with `invalidOperation` on other hosts.
- `listPackages()` always includes the bundled folder `engines/stockfish` (source `Bundled`, files from `StockfishConfig.files`). On the browser it adds one `User` package per stored root under `engine-files/`, using the folder name as `displayName`. Root enumeration failure rejects discovery; a per-folder file-list failure still returns that folder with a `warning`.
- The bundled package is served from app files and is never copied into managed storage or removable. **Why:** both hosts load it directly from app files, so copying it into managed storage would only add a second copy and the restore workflow that the design deliberately dropped. See [EngineInstallationReworkPlan](../../../ArchivedPlans/EngineInstallationReworkPlan.md#browser-import-and-defaults).
- Imported folders are reconstructed from generic stored-file keys `[packagePath, relativePath]` in the `chessvue-engines` database. Files keep their original names, relative paths and bytes. There is no manifest, installation record, catalogue, stored entry selection or version field. **Why:** upstream archives do not carry a ChessVue manifest, and a successful import already consists of its stored files, so a separate record would only duplicate them; the profile records the chosen entry and client type.
- `readArchive(...)` rejects absolute, drive, backslash, control-character, empty, `.` and `..` segments, duplicate entries, empty archives and file/folder path conflicts. Decoding honours its `AbortSignal`.
- The import view owns engine-name character rules and case-insensitive uniqueness against its complete loaded list. `install(...)` revalidates archive contents, derives `engine-files/<engineName>` and awaits one atomic write, returning that `packagePath`. Cancellation and failure settle the actual transaction before returning, so a failed or cancelled import publishes no files.
- `remove(...)` accepts only a direct `engine-files/<name>` folder. It rejects with `invalidOperation`, naming the referencing labels, when any supplied `UciWorker` reference has an `entryPath` inside that folder. The caller supplies accepted and draft profiles plus open-game assignments; temporary engine operations add no check, lease or registry. Desktop targets are never touched.
- `WorkerScriptLoader` is private reusable support with no engine contracts or policy. This service uses only its storage operations and exposes no file-read or serving API; each process manager owns a separate loader that reads stored files when it creates a Worker. Runtime APIs and UCI sequencing are unaffected.
- Operation failures retain their operation name through `PlatformError` (`listEnginePackages`, `listEnginePackageFiles`, `readEngineArchive`, `validateEnginePackageFiles`, `installEnginePackage`, `removeEnginePackage`), so a failed write is distinguishable from a failed rediscovery after commit.

Detailed API decisions and stacked function flows: [EngineInstallationReworkPlan](../../../ArchivedPlans/EngineInstallationReworkPlan.md#function-flows).
