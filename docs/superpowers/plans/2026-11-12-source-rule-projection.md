# Character source-rule projection implementation plan

- [ ] Add failing engine test for shipped Ishaya record + assignment to Sea Guard; test no assignment, wrong unit, mismatched/unverified records, independent duplicates and immutable imports.
- [ ] Add browser smoke verifying card, attack panel and Effects tab show Precision Strikes after joining and remove it when detached.
- [ ] Add reviewed special-rule data with a generic projection engine accepting `unitDataRecords`, and call it from `projectArmyEffects`.
- [ ] Improve compact benefit names and source-rule audit disclosure, without adding inferred stats/effects.
- [ ] Bump service worker app shell, update cache tests, run Node + Playwright suites.
- [ ] Open PR, review logs and merge only on verified success (user previously authorised automatic merges of fixes). Verify GitHub Pages deployment.
