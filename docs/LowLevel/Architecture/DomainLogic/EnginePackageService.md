# EnginePackageService

Own engine-folder discovery, ZIP validation and browser file import/removal. Desktop profiles retain direct executable/script paths. The ordinary bundled folder is listed alongside imported folders.

## Public interface

```ts
canInstall(): boolean;
listPackages(): Promise<readonly IEnginePackage[]>;
browseEngineFile(startDirectory?: string): Promise<string>;
readArchive(file: IEnginePackageFile, signal?: AbortSignal): Promise<IEngineArchive>;
install(engineName: string, archive: IEngineArchive, signal?: AbortSignal): Promise<string>;
remove(packagePath: string, references: readonly IEnginePackageUsage[]): Promise<void>;
```

The service reconstructs imported folders from generic stored-file keys. Files preserve their original names, relative paths and bytes. There is no manifest, installation record, catalogue, stored entry selection or version field. Root enumeration failure rejects discovery; a per-folder read failure remains a visible folder with a warning.

The import view owns name-character and case-insensitive uniqueness validation against its complete loaded list. The service validates ZIP paths, duplicates and file/folder conflicts, then directly awaits its private generic library's atomic write. Cancellation and failure settle the actual transaction before returning. EnginesStore performs rediscovery after commit and reports a failed refresh separately.

Removal checks supplied accepted/draft profiles and open-game assignments at exact package boundaries, then directly awaits atomic deletion. Temporary operations add no check, lease or registry. Bundled files and desktop targets are outside removal.

StoredWorkerUtility is private reusable support, with no engine contracts or policy. The service imports its file operations; it exposes no readFile or serving API. The manager-owned execution loader registers the generic library entry; its worker-side object serves original bytes independently of this domain service. Runtime APIs and UCI sequencing are unchanged.

Detailed API and stacked function flows: [engine installation rework](../../../EngineInstallationReworkPlan.md#function-flows).
