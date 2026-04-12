# Task: Implement Target Language Command (/target) Step-by-Step (Granular)

### Phase 1: Data Model & Persistence
- [x] Add `translationLanguage` defaults to `app_config.js`
- [x] Implement `getTranslationTarget()` and `setTranslationTarget()` in `AppConfig` class

### Phase 2: Granular Command Integration
- [x] 2.1 Create minimal empty `src/commands/target.js` (valid but static)
- [x] 2.2 Register `target.js` in `src/commands/index.js` (Check if /mode breaks here)
- [ ] 2.3 Implement single hardcoded item in `handleSearch` (Verify routing)
- [ ] 2.4 Implement full language list in `handleSearch`
- [ ] 2.5 Implement `handleSelect` logic

### Phase 3: Translation Flow Integration
- [ ] Support `targetOverride` in `UtoolsHelper.detectLanguages`
- [ ] Integrate into `preload.js`
