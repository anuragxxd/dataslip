#!/usr/bin/env sh

set -eu

REPO="${DATASLIP_REPO:-anuragxxd/dataslip}"
PROGRAM="dataslip"
GITHUB_API="https://api.github.com/repos/$REPO"

say() {
  printf '%s\n' "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

download() {
  download_url="$1"
  download_output="$2"

  if [ -n "${DATASLIP_GITHUB_TOKEN:-}" ]; then
    curl -fsSL -H "Authorization: Bearer $DATASLIP_GITHUB_TOKEN" "$download_url" -o "$download_output"
    return
  fi

  curl -fsSL "$download_url" -o "$download_output"
}

api_get() {
  api_url="$1"
  api_output="$2"
  [ -n "${DATASLIP_GITHUB_TOKEN:-}" ] || die 'DATASLIP_GITHUB_TOKEN is required for GitHub API access.'
  curl -fsSL -H "Authorization: Bearer $DATASLIP_GITHUB_TOKEN" "$api_url" -o "$api_output"
}

get_latest_release() {
  if [ -n "${DATASLIP_GITHUB_TOKEN:-}" ]; then
    curl -fsSL -H "Authorization: Bearer $DATASLIP_GITHUB_TOKEN" "$GITHUB_API/releases/latest" | awk -F'"' '/"tag_name":/ { print $4; exit }'
    return
  fi

  curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" | awk -F/ '{print $NF}'
}

normalize_os() {
  case "$(uname -s)" in
    Linux) printf 'linux\n' ;;
    Darwin) printf 'darwin\n' ;;
    MINGW*|MSYS*|CYGWIN*) printf 'windows\n' ;;
    *) die "Unsupported operating system: $(uname -s)" ;;
  esac
}

normalize_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf 'x64\n' ;;
    arm64|aarch64) printf 'arm64\n' ;;
    *) die "Unsupported architecture: $(uname -m)" ;;
  esac
}

resolve_version() {
  if [ -n "${DATASLIP_VERSION:-}" ]; then
    case "$DATASLIP_VERSION" in
      v*) printf '%s\n' "$DATASLIP_VERSION" ;;
      *) printf 'v%s\n' "$DATASLIP_VERSION" ;;
    esac
    return
  fi

  get_latest_release
}

choose_asset() {
  case "$1-$2" in
    darwin-arm64) printf 'dataslip-darwin-arm64.tar.gz\n' ;;
    darwin-x64) printf 'dataslip-darwin-x64.tar.gz\n' ;;
    linux-x64) printf 'dataslip-linux-x64.tar.gz\n' ;;
    windows-x64) printf 'dataslip-windows-x64.zip\n' ;;
    *) die "No prebuilt DataSlip binary for $1-$2. Supported targets: darwin-arm64, darwin-x64, linux-x64, windows-x64." ;;
  esac
}

resolve_install_dir() {
  target_os="$1"

  if [ -n "${DATASLIP_INSTALL_DIR:-}" ]; then
    printf '%s\n' "$DATASLIP_INSTALL_DIR"
    return
  fi

  if [ -n "${XDG_BIN_DIR:-}" ]; then
    printf '%s\n' "$XDG_BIN_DIR"
    return
  fi

  [ -n "${HOME:-}" ] || die 'HOME is not set. Please set DATASLIP_INSTALL_DIR.'

  case "$target_os" in
    windows) printf '%s/bin\n' "$HOME" ;;
    *) printf '%s/.local/bin\n' "$HOME" ;;
  esac
}

verify_checksum() {
  checksum_file="$1"
  archive_path="$2"
  archive_name="$3"

  [ -f "$checksum_file" ] || return 0

  expected="$(awk -v asset="$archive_name" '$2 == asset { print $1 }' "$checksum_file")"
  [ -n "$expected" ] || return 0

  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$archive_path" | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$archive_path" | awk '{print $1}')"
  else
    say 'Skipping checksum verification: no SHA-256 tool found.'
    return 0
  fi

  [ "$expected" = "$actual" ] || die "Checksum verification failed for $archive_name"
  say 'Verified checksum.'
}

install_binary() {
  source_path="$1"
  install_path="$2"

  if mkdir -p "$(dirname "$install_path")" 2>/dev/null && install -m 755 "$source_path" "$install_path" 2>/dev/null; then
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo mkdir -p "$(dirname "$install_path")"
    sudo install -m 755 "$source_path" "$install_path"
    return 0
  fi

  die "Could not write to $(dirname "$install_path"). Set DATASLIP_INSTALL_DIR to a writable path or rerun with sudo available."
}

find_asset_api_url() {
  metadata_path="$1"
  asset_name="$2"

  awk -F'"' -v asset="$asset_name" '
    /"url": "https:\/\/api.github.com\/repos\/.*\/releases\/assets\// { asset_url = $4 }
    /"name":/ && $4 == asset { print asset_url; exit }
  ' "$metadata_path"
}

download_release_asset() {
  version="$1"
  asset_name="$2"
  output="$3"

  if [ -n "${DATASLIP_GITHUB_TOKEN:-}" ]; then
    metadata_path="$TMP_DIR/release-${version}.json"
    api_get "$GITHUB_API/releases/tags/$version" "$metadata_path"
    asset_api_url="$(find_asset_api_url "$metadata_path" "$asset_name")"
    [ -n "$asset_api_url" ] || die "Could not find asset $asset_name in release $version"
    curl -fsSL \
      -H "Authorization: Bearer $DATASLIP_GITHUB_TOKEN" \
      -H "Accept: application/octet-stream" \
      "$asset_api_url" -o "$output"
    return
  fi

  download "https://github.com/$REPO/releases/download/$version/$asset_name" "$output"
}

need_cmd curl
need_cmd install
need_cmd tar

OS="$(normalize_os)"
ARCH="$(normalize_arch)"
VERSION="$(resolve_version)"
ASSET="$(choose_asset "$OS" "$ARCH")"
INSTALL_DIR="$(resolve_install_dir "$OS")"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="$TMP_DIR/$ASSET"
CHECKSUM_PATH="$TMP_DIR/SHA256SUMS"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

say "Installing DataSlip $VERSION for $OS/$ARCH"
say "Download: https://github.com/$REPO/releases/download/$VERSION/$ASSET"

download_release_asset "$VERSION" "$ASSET" "$ARCHIVE_PATH"
download_release_asset "$VERSION" "SHA256SUMS" "$CHECKSUM_PATH" || true
verify_checksum "$CHECKSUM_PATH" "$ARCHIVE_PATH" "$ASSET"

case "$ASSET" in
  *.tar.gz)
    tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"
    BINARY_PATH="$TMP_DIR/$PROGRAM"
    ;;
  *.zip)
    need_cmd unzip
    unzip -oq "$ARCHIVE_PATH" -d "$TMP_DIR"
    BINARY_PATH="$TMP_DIR/$PROGRAM.exe"
    ;;
  *)
    die "Unsupported archive format: $ASSET"
    ;;
esac

[ -f "$BINARY_PATH" ] || die "Could not find $PROGRAM inside $ASSET"

INSTALL_PATH="$INSTALL_DIR/$PROGRAM"
if [ "$OS" = 'windows' ]; then
  INSTALL_PATH="$INSTALL_DIR/$PROGRAM.exe"
fi

install_binary "$BINARY_PATH" "$INSTALL_PATH"

say "Installed to $INSTALL_PATH"

case ":${PATH:-}:" in
  *":$INSTALL_DIR:"*)
    say "Run: $PROGRAM"
    ;;
  *)
    say "Add this directory to your PATH: $INSTALL_DIR"
    say "Then run: $PROGRAM"
    ;;
esac
