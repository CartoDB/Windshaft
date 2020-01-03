# How to release

1. Test (`npm test`), fix if broken before proceeding.
2. Merge patch, feature to master.
3. Ensure proper version in `package.json` and `package-lock.json`.
4. Ensure `NEWS.md` section exists for the new version, review it, add release date.
5. Commit `package.json`, `package-lock.json`, NEWS.
6. Run `git tag -a Major.Minor.Patch`. Use NEWS section as content.
7. `npm publish` to registry.
8. Stub NEWS/package for next version.

Versions should follow http://semver.org/spec/v2.0.0.html.
