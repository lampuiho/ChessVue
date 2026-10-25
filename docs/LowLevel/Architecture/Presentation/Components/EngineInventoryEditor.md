# Engine inventory presentation

SettingsView renders the engine list and navigates through Router to EngineProfileView for new/edit/copy. EnginePackageImportView and EnginePackageDetailsView are separate Settings child views. No EngineInventoryEditor component or EngineProfileModal is part of the implementation.

Each profile form owns its fields and option rows. Add/Update writes the Settings draft and returns to the overview; Apply/Save persists the draft. Copy uses a new profile identity and a distinct proposed display name. The entry path is explicit and no helper filename or entry is inferred.

Import validates the unique engine folder name on the frontend and preserves original ZIP files. Details lists files and accepted/draft profile/open-game references. Only simple file-removal confirmation is a modal.

See the [engine UI design and routed function flows](../../../../EngineManagementUiDesign.md).
