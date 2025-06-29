# 26. Extensions Cache

## Brainstorming

Supplementing the basic extensions feature in '25 Import extensions' this feature provides a mechanism for installing an extension from a cache that the app maintains in File Storage at `extensions/`. The cache is added to any time a workspace is created with a `SOURCE/extensions/<ext-directory>` that isn't already present. This feature needs a way to manage the cached extensions - really just deleting them when the user decides they're not needed. Then in the `settings` view the user can choose to import a cached extension rather than just load from a local file.

## Overview

TBD

## Requirements

- No fancy namespace collision or anything, cached extensions identified by filename without the file extension
- Bring the extension script's `LICENSE.txt` file and `transform.js with it from the cache
- TBD

## Dependencies

- TBD

## Technical Approach

- TBD

## API Design

```

```

TBD

## Testing Considerations

- TBD

## Implementation Notes

- TBD
