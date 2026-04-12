# Task: Context-based Command Filtering (Sticky Mode)

- [x] Refactor `CommandManager` (src/commands/index.js)
    - [x] Add `activeCommand` state and helper methods
    - [x] Implement 4-tier routing in `handleSearch`
    - [x] Update `handleSelect` to manage context lifecycle
- [x] Update `preload.js` search dispatching logic
- [x] Support "Return to Translation" items in sub-commands
    - [x] Modify `src/commands/target.js`
    - [x] Modify `src/commands/mode.js`
- [x] Verification
    - [x] Manual test of `/target` flow
    - [x] Manual test of Sticky Mode (empty input)
    - [x] Manual test of Context Switch
    - [x] Regression test of standard translation
