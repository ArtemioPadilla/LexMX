---
description: Run check + push current branch + open a PR with --fill --web. Stops on the first failure.
---

Run `npm run ship` and surface the result.

```bash
npm run ship
```

If the build/type/test gates pass and the PR opens, share the URL. If a gate
fails, do not attempt to push — show the failing step and offer to help fix
it before retrying.
