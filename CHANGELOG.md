<!-- eslint-disable markdown/no-missing-label-refs -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge webhooks plugin changelog

[![npm version](https://img.shields.io/npm/v/matterbridge-bthome.svg)](https://www.npmjs.com/package/matterbridge-bthome)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-bthome.svg)](https://www.npmjs.com/package/matterbridge-bthome)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-bthome/actions/workflows/build.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge-bthome/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge-bthome)
[![styled with prettier](https://img.shields.io/badge/styled_with-Prettier-f8bc45.svg?logo=prettier)](https://prettier.io/)
[![linted with eslint](https://img.shields.io/badge/linted_with-ES_Lint-4B32C3.svg?logo=eslint)](https://eslint.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

[![powered by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on [GitHub](https://github.com/Luligu/matterbridge-bthome) and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [1.0.5] - Dev branch

- [package]: Preliminary compatibility update to `matterbridge 3.8.0`, matter 1.5.1 and matter.js 0.17.0.
- [package]: Update dependencies.
- [package]: Bump package to `automator` v.3.1.6.
- [package]: Bump `node-ansi-logger` to v.3.2.1.
- [package]: Bump `node-persist-manager` to v.2.0.2.
- [package]: Bump `prettier` to v.3.8.2.
- [package]: Bump `typescript` to v.6.0.3.
- [package]: Bump `eslint` to v.10.2.1.
- [package]: Bump `typescript-eslint` to v.8.59.0.
- [package]: Add `.vscode\tasks.json`.
- [package]: Add `.vscode\settings.json`.
- [devcontainer]: Add `Claude Code for VS Code extension` to Dev Container.
- [agent]: Add `.github\copilot-instructions.md` for copilot.
- [agent]: Add `.claude\CLAUDE.md` for claude.
- [agent]: Add agent custom instructions (`testing`) for copilot and claude.
- [agent]: Add agent custom instructions (`matterbridge`) for copilot and claude.
- [devcontainer]: Fix pull of new image.
- [devcontainer]: Update VS Code settings.
- [devcontainer]: Leave matterbridge scripts in the cloned repo.
- [scripts]: Update mb-run script.
- [scripts]: Update package watch script.
- [scripts]: Add prune-releases script.
- [devcontainer]: Update `Dev Container` configuration.
- [devcontainer]: Add `postStartCommand` to the Dev Container configuration.
- [package]: Refactor `build.yml` to use matterbridge dev branch for push and main for pull requests.
- [package]: Add `type checking` script for Jest tests.
- [package]: Update actions versions in workflows.
- [package]: Add `CODE_OF_CONDUCT.md`.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.4] - 2026-02-07

### Changed

- [package]: Updated dependencies.
- [package]: Bumped package to automator v.3.0.6.
- [package]: Bumped node-ansi-logger to v.3.2.0.
- [vite]: Added cache under .cache/vite.
- [workflow]: Migrated to trusted publishing / OIDC. Since you can authorize only one workflow with OIDC, publish.yml now does both the publishing with tag latest (on release) and with tag dev (on schedule or manual trigger).

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.3] - 2026-01-20

### Added

- [matter]: Conformance to Matter 1.4.2 and matterbridge 3.5.x.

### Changed

- [package]: Updated dependencies.
- [package]: Updated package to automator v. 3.0.0.
- [package]: Refactored Dev Container to use Matterbridge mDNS reflector.
- [package]: Requires Matterbridge v.3.5.0.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.2] - 2025-12-12

### Changed

- [package]: Updated dependencies.
- [package]: Updated to the current Matterbridge signatures.
- [package]: Required matterbridge v.3.4.0.
- [package]: Updated to the Matterbridge Jest module.
- [package]: Bumped package to automator v.2.1.0.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.1] - 2025-11-14

### Changed

- [package]: Updated dependencies.
- [package]: Bumped package to automator v.2.0.12.
- [package]: Updated to the current Matterbridge signatures.
- [jest]: Updated jestHelpers to v.1.0.12.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.0] - 2025-10-28

### Changed

- [package]: Updated dependencies.
- [package]: Bumped platform to v.1.0.0.
- [package]: Bumped package to automator v.2.0.10.
- [jest]: Bumped jestHelpers to v.1.0.10.
- [package]: Require matterbridge v.3.3.0.
- [package]: Added default config.
- [platform]: Updated to new signature PlatformMatterbridge.
- [workflows]: Ignore any .md in build.yaml.
- [workflows]: Ignore any .md in codeql.yaml.
- [workflows]: Ignore any .md in codecov.yaml.
- [workflows]: Improved speed on Node CI.
- [devcontainer]: Added the plugin name to the container.
- [devcontainer]: Improved performance of first build with shallow clone.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.3] - 2025-05-19

### Changed

- [platform]: Updated deprecated import to run with matterbridge 3.0.3.
- [package]: Updated package.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.2] - 2025-05-15

### Added

- [logger]: Added onChangeLoggerLevel action.

### Changed

- [package]: Updated dependencies.

### Fixed

- [update]: Fixed bug on update with multiple properties.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.1] - 2025-05-05

First published release.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

<!-- Commented out section
## [1.1.2] - 2024-03-08

### Added

- [Feature 1]: Description of the feature.
- [Feature 2]: Description of the feature.

### Changed

- [Feature 3]: Description of the change.
- [Feature 4]: Description of the change.

### Deprecated

- [Feature 5]: Description of the deprecation.

### Removed

- [Feature 6]: Description of the removal.

### Fixed

- [Bug 1]: Description of the bug fix.
- [Bug 2]: Description of the bug fix.

### Security

- [Security 1]: Description of the security improvement.
-->
