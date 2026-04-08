# SavedGameDocumentService

## Purpose
Own layer-2 saved-game document I/O, managed-save enumeration, and import/export picker access for canonical game documents.

## Public Interface
```ts
listManagedSaveEntries(rootPath: string): Promise<ReadonlyMap<string, IFileSystemEntry[]>>
readDocument(filePath: string): Promise<string>
writeDocument(filePath: string, raw: string, overwrite?: boolean): Promise<void>
deleteDocument(filePath: string): Promise<void>
selectImportFile(startDirectory?: string): Promise<string>
selectExportFile(suggestedPath?: string): Promise<string>
```

## Responsibilities
- wrap `StorageAdapter` so saved-game flows stay on the layer-2 side of the platform boundary
- enumerate the caller-selected managed-save root as raw directory-entry data for later interpretation by `SavedGameIndexService`
- read and write canonical saved-game document text without owning payload migration or validation rules
- expose import and export picker operations for caller-owned flows without leaking host dialog APIs to stores
- keep raw file I/O distinct from save-root path composition and saved-game grouping rules

## Dependencies
- `StorageAdapter`

## Scenario Coverage
- `SCN-SESSION-02`
- `SCN-SESSION-03`
- `SCN-SAVE-01` to `SCN-SAVE-03`
- `SCN-LOAD-01`
- `SCN-EXPORT-01`
- `SCN-IMPORT-01`
- `SCN-IMPORT-02`
- `SCN-LIFECYCLE-01`

## Notes
- `SavedGameDocumentService` performs no JSON migration or document interpretation. `SerializationService` remains the owner of canonical payload conversion and validation.
- `SavedGameIndexService` remains pure and owns save-root conventions, canonical file paths, grouping, and latest-save selection only.
- `rootPath` is caller-owned managed-save policy. In the first desktop implementation it may point to any user-accessible directory.
- `SavedGameDocumentService` does not validate whether a managed-save root is acceptable for product policy. It only performs raw directory and document operations against the path it is given.
- `StorageAdapter` remains rootless. Managed-save root resolution belongs to higher-layer settings and domain rules, not to the platform adapter.
