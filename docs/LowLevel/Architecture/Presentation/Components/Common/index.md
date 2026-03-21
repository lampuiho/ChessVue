# Common Components

## Purpose
Define reusable presentation primitives and functional UI wrappers shared across views and feature components.

## Components
- [ActionButton](ActionButton.md)
- [ItemList](ItemList.md)
- [PanelSurface](PanelSurface.md)
- [TabbedView](TabbedView.md)
- [ModalDialog](ModalDialog.md)

## Rules
- Common components are generic and domain-agnostic.
- They accept display data, slots, and emitted events, but they do not know about chess rules, stores, routes, or persistence.
- Feature components compose these primitives rather than reimplementing tab, list, panel, and button behaviour ad hoc.
