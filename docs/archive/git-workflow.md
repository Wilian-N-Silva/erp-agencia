# Git workflow

Use `main` as the release branch.

Use `development` as the central integration branch for product work after `main`.

Create every feature, fix, or chore from `development`:

```text
main
  development
    feature/<scope>
    fix/<scope>
    chore/<scope>
```

Rules:

1. Do not implement features directly on `main`.
2. Do not implement features directly on `development` unless the work is explicitly a development-branch maintenance task.
3. Branch from `development` before changing files.
4. Merge feature branches back into `development`.
5. Promote `development` to `main` only for releases.