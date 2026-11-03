# Visible app release

The sidebar displays `APP_VERSION` from `lib/release.ts` below the workspace label. Update this value with each published app release. Version 28 introduces the label and corresponds to Sites saved version 28.

The label is compiled into the page bundle. It describes the code loaded in that tab; do not replace it with a live “latest deployment” lookup, which could make an older tab appear current. Previously open tabs without this label need a reload after preserving any unsaved work.

Validate with TypeScript and the production build, then confirm the label in the hosted sidebar. This display-only change needs no migration and changes no saved user data or permissions.
