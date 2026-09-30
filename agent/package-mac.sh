#!/bin/bash
#
# The macOS agent as a signed, notarised .dmg - built here, once, rather than compiled on every machine.
#
#   agent/package-mac.sh                 build, sign, notarise and staple both images
#   agent/package-mac.sh --no-notarize   build and sign only (for trying it on this Mac)
#
# Writes agent/dist/MouseFlow-Agent.dmg (P1, "Do it for me": watches and acts) and
# agent/dist/MouseFlow-Agent-RecordOnly.dmg (P2, "Make it reusable": watches only, owner 2026-10-01).
# The web build copies both to /agent/ (web/scripts/copy-agent.mjs), and Connections links to them.
#
# WHY THIS EXISTS BESIDE install-mac.sh. The installer compiles on the person's machine, which needs the Xcode
# tools and a `curl | bash` that company IT rarely allows. A Developer ID signature plus Apple's notarisation
# is what lets a downloaded app open without Gatekeeper refusing it. The installer stays: it is the path for
# a Mac without a download, and for anybody who reads the source before running it.
#
# ONE BINARY, TWO IMAGES. The record-only image is the same binary with MFRecordOnly in its Info.plist. The
# plist is sealed by the signature, so the key cannot be removed without breaking it - which is the point:
# the build sold as "never controls your computer" has no switch to turn that off.
#
# NOTARISATION NEEDS A KEYCHAIN PROFILE, made once by the owner with their own Apple ID - never by a script:
#   xcrun notarytool store-credentials mouseflow-notary --apple-id <apple id> --team-id <team>
# Override the profile name with MOUSEFLOW_NOTARY_PROFILE.

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
source_file="${here}/mouseflow-agent.swift"
dist="${here}/dist"
origin="https://mouseflowapp.vercel.app"
profile="${MOUSEFLOW_NOTARY_PROFILE:-mouseflow-notary}"
notarize="yes"
[ "${1:-}" = "--no-notarize" ] && notarize="no"

# The plist and the entitlements come from the installer, not a second copy of them: two editions of the
# plist would one day disagree about the key that decides whether the microphone opens at all.
MOUSEFLOW_INSTALLER_LIBRARY=1 source "${here}/install-mac.sh"

identity="$(security find-identity -v -p codesigning 2>/dev/null \
  | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)"
if [ -z "$identity" ]; then
  echo "No Developer ID Application certificate in this keychain - a .dmg signed any other way would be" >&2
  echo "refused by Gatekeeper on every other Mac. Use install-mac.sh instead." >&2
  exit 1
fi
if [ "$notarize" = "yes" ] && ! xcrun notarytool history --keychain-profile "$profile" >/dev/null 2>&1; then
  cat >&2 <<NEEDS
There is no notarisation profile called "${profile}" in the keychain. Make it once, with your own Apple ID
and an app-specific password (appleid.apple.com, Sign-In and Security, App-Specific Passwords):

  xcrun notarytool store-credentials ${profile} --apple-id <your Apple ID> --team-id <your team id>

Or build without notarising, to try it on this Mac only:  agent/package-mac.sh --no-notarize
NEEDS
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$dist"

# ------------------------------------------------------------------ one universal binary
# Both architectures, because a download does not know which Mac it lands on. macOS 13 is the floor the
# installer's plist already declares (LSMinimumSystemVersion).
echo "Compiling for arm64 and x86_64"
swiftc -O -target arm64-apple-macos13 -o "${work}/agent-arm64" "$source_file"
swiftc -O -target x86_64-apple-macos13 -o "${work}/agent-x86_64" "$source_file"
lipo -create -output "${work}/mouseflow-agent" "${work}/agent-arm64" "${work}/agent-x86_64"

write_entitlements "${work}/entitlements.plist"

# ------------------------------------------------------------------ one image per product
build_image() {
  local image="$1" extra="$2"
  local stage="${work}/stage-${image}"
  local app="${stage}/MouseFlow Agent.app"
  mkdir -p "${app}/Contents/MacOS"
  cp "${work}/mouseflow-agent" "${app}/Contents/MacOS/mouseflow-agent"
  write_plist_info "$app" "$source_file" "$extra"

  # --timestamp and the hardened runtime are what notarisation requires; the identifier is the installer's,
  # so an install from either path is the same app to TCC and the grants carry over.
  codesign --force --options runtime --timestamp --entitlements "${work}/entitlements.plist" \
    --sign "$identity" --identifier "$BUNDLE_ID" "$app"
  codesign --verify --strict --verbose=1 "$app"

  ln -s /Applications "${stage}/Applications"
  local dmg="${dist}/${image}.dmg"
  rm -f "$dmg"
  hdiutil create -quiet -volname "MouseFlow Agent" -srcfolder "$stage" -ov -format UDZO "$dmg"
  codesign --force --timestamp --sign "$identity" "$dmg"

  if [ "$notarize" = "yes" ]; then
    echo "Notarising ${image}.dmg (Apple answers in a minute or several)"
    xcrun notarytool submit "$dmg" --keychain-profile "$profile" --wait
    xcrun stapler staple "$dmg"
    spctl --assess --type open --context context:primary-signature --verbose=2 "$dmg"
  fi
  echo "Built ${dmg} ($(du -h "$dmg" | cut -f1))"
}

packaged="  <key>MFPackaged</key><true/>
  <key>MFAllowOrigin</key><string>${origin}</string>"
build_image "MouseFlow-Agent" "$packaged"
build_image "MouseFlow-Agent-RecordOnly" "${packaged}
  <key>MFRecordOnly</key><true/>"

[ "$notarize" = "yes" ] || echo "NOT notarised: these open on this Mac, and Gatekeeper refuses them anywhere else."
