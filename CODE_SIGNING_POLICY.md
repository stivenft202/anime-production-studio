# Code Signing Policy

This document describes the code signing policy of the **Anime Production
Studio** project, as required by the SignPath Foundation for free open
source code signing.

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

## Scope

Only the project's own binaries are signed:

- The Windows installer `ANIME-PRODUCTION-STUDIO-SETUP.exe` and the
  application executable it contains, built from the source code in this
  repository (`https://github.com/stivenft202/anime-production-studio`).
- Builds are produced exclusively by the automated GitHub Actions workflow
  defined in `.github/workflows/build-windows.yml`, running on
  GitHub-hosted `windows-latest` runners. The build is fully transparent:
  every step (checkout, dependency install, build, packaging, NSIS
  installer creation) is visible in the workflow file and in the public
  Actions run logs.

## What is never signed

- Binaries from third parties, or binaries not built from this repository.
- Binaries built on a developer's local machine, outside GitHub Actions.
- Any file that is not part of a tagged release of this project.
- Pre-release or experimental builds that have not been reviewed and
  approved by the project maintainer.

## Approval process

- Every release requires explicit manual approval by the project
  maintainer before it is published and signed.
- Signing is requested per release: there is no standing or automatic
  approval for future versions.
- The maintainer reviews the changes included in the release (source
  diff, dependency changes, and the build log) before approving.
- If a release is found to contain anything suspicious, signing is
  refused and the release is not published.

## Certificate

The code signing certificate is issued to the **SignPath Foundation**.
Binaries signed under this policy show "SignPath Foundation" as the
publisher. This does not mean the SignPath Foundation authors, endorses,
or is responsible for this software: it only vouches that the binary was
built from the public source code of this repository through the
transparent build process described above.

## Reporting abuse

If you believe a binary signed under this policy does not match the
public source code of this repository, contains malware, or is being
misused in any way, please report it:

- Open an issue at
  https://github.com/stivenft202/anime-production-studio/issues, or
- Contact the SignPath Foundation through the abuse reporting channel
  listed at https://signpath.org/.

Reports are taken seriously: a confirmed abuse report will lead to the
immediate suspension of signing for this project.

## License

This project is released under the MIT License. See the
[LICENSE](LICENSE) file in the root of this repository.
