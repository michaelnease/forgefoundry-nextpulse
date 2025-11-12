#!/usr/bin/env bash
#
# zip-diff.sh - Export git changes as a portable zip (or tar.gz) archive
#
# Usage Examples:
#   # Basic usage: diff against default base ref
#   scripts/zip-diff.sh
#
#   # Diff against specific base with working tree changes
#   scripts/zip-diff.sh --base origin/main --include-work
#
#   # Custom output name
#   scripts/zip-diff.sh --out my-changes.zip
#
#   # Diff since a tag
#   scripts/zip-diff.sh --since v1.0.0
#
#   # Full example with all options
#   scripts/zip-diff.sh --base origin/main --include-work --out nextpulse-diff-dev.zip
#
# Description:
#   Creates an archive containing:
#   - patch.diff: Git patch file of changes
#   - Changed files in their folder structure
#   - summary.txt: Contextual information about the changes
#   - manifest.txt: SHA256 checksums of all files in the archive
#
# Options:
#   --base <ref>       Base git ref to diff against (overrides auto-detection)
#   --include-work     Include staged, unstaged, and untracked working tree changes
#   --since <tag>      Alternative base using a tag or commit
#   --out <name>       Custom archive file name (default: nextpulse-diff-<YYYYMMDD-HHMM>.zip)
#
# Requirements:
#   - git, bash, coreutils
#   - zip or tar available for archiving

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Defaults
BASE_REF="${BASE_REF:-}"
INCLUDE_WORK=false
SINCE_REF=""
OUTPUT_NAME=""
# Depth for searching next.config.* in monorepos
NEXTCONFIG_DEPTH="${NEXTCONFIG_DEPTH:-6}"

# Exclusions
EXCLUDE_PATTERNS=("node_modules" ".next" ".turbo" "dist" "build" "coverage" ".cache" ".pnpm-store" "tmp" ".git")

# Always include metadata-like files even if unchanged
ALWAYS_INCLUDE=(
  "package.json" "package-lock.json" "pnpm-lock.yaml" "yarn.lock"
  "nx.json" "nx.workspaces.json" "turbo.json" "turbo.config.ts" "tsconfig.base.json"
  ".nvmrc" ".tool-versions" ".gitignore" ".gitattributes" ".env" ".env.example"
)

print_usage() {
  echo "Usage: $0 [--base <ref>] [--include-work] [--since <tag>] [--out <name>]" >&2
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      [[ $# -ge 2 ]] || { echo -e "${RED}Error: --base requires a value${NC}" >&2; exit 1; }
      BASE_REF="$2"; shift 2;;
    --include-work)
      INCLUDE_WORK=true; shift;;
    --since)
      [[ $# -ge 2 ]] || { echo -e "${RED}Error: --since requires a value${NC}" >&2; exit 1; }
      SINCE_REF="$2"; shift 2;;
    --out)
      [[ $# -ge 2 ]] || { echo -e "${RED}Error: --out requires a value${NC}" >&2; exit 1; }
      OUTPUT_NAME="$2"; shift 2;;
    -h|--help)
      print_usage; exit 0;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}" >&2
      print_usage
      exit 1;;
  esac
done

# Ensure git exists
if ! command -v git >/dev/null 2>&1; then
  echo -e "${RED}Error: git is not installed or not in PATH${NC}" >&2
  exit 1
fi

# Ensure we are in a git repo
GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$GIT_ROOT" ]]; then
  echo -e "${RED}Error: Not in a git repository or git not initialized${NC}" >&2
  exit 1
fi
cd "$GIT_ROOT"

# Determine base ref
# Priority: --since > --base > BASE_REF env > auto-detect origin/main, origin/master, origin/HEAD
if [[ -n "$SINCE_REF" ]]; then
  BASE_REF="$SINCE_REF"
elif [[ -z "$BASE_REF" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    BASE_REF="origin/main"
  elif git rev-parse --verify --quiet origin/master >/dev/null; then
    BASE_REF="origin/master"
  else
    # Try the remote default branch
    if DEFAULT_BRANCH="$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/@@')"; then
      BASE_REF="$DEFAULT_BRANCH"
    else
      echo -e "${RED}Error: Could not determine base ref. Provide --base or set BASE_REF env var.${NC}" >&2
      exit 1
    fi
  fi
fi

# Verify base ref exists
if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  echo -e "${RED}Error: Base ref '$BASE_REF' does not exist${NC}" >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
REPO_NAME="$(basename "$GIT_ROOT")"

# Output name
if [[ -z "$OUTPUT_NAME" ]]; then
  TIMESTAMP="$(date +%Y%m%d-%H%M)"
  OUTPUT_NAME="nextpulse-diff-${TIMESTAMP}.zip"
fi
OUTPUT_NAME="${OUTPUT_NAME%.zip}.zip"
# Export to scripts/temp directory
OUTPUT_DIR="$GIT_ROOT/scripts/temp"
mkdir -p "$OUTPUT_DIR"
OUTPUT_PATH="$OUTPUT_DIR/$OUTPUT_NAME"

# Staging dir
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

echo -e "${GREEN}Creating diff archive...${NC}"
echo "  Base ref: $BASE_REF"
echo "  Include work: $INCLUDE_WORK"
echo "  Output: $OUTPUT_NAME"

# Helpers
is_excluded() {
  local p="$1"
  case "/$p/" in
    */.git/*|*/node_modules/*|*/.next/*|*/.turbo/*|*/dist/*|*/build/*|*/coverage/*|*/.cache/*|*/.pnpm-store/*|*/tmp/*)
      return 0;;
    *) return 1;;
  esac
}

# Build list of changed files
CHANGED_FILES=()

# Committed changes relative to base
while IFS= read -r line; do
  [[ -n "$line" ]] || continue
  CHANGED_FILES+=("$line")
done < <(git diff --name-only --diff-filter=ACMR --relative "$BASE_REF"...HEAD 2>/dev/null || true)

# Working tree changes
if [[ "$INCLUDE_WORK" == true ]]; then
  # Use porcelain v1 with -z to safely parse paths and renames
  # Entries are NUL-delimited. For R/C there is a second NUL-delimited path.
  while IFS= read -r -d '' rec; do
    # rec starts with two status chars then a space then path (or first path for R/C)
    status="${rec:0:2}"
    path="${rec:3}"
    case "$status" in
      \?\?) # untracked
        CHANGED_FILES+=("$path")
        ;;
      R*|C*) # rename or copy, read second path for destination
        # Read the destination path from the next NUL-delimited token
        if IFS= read -r -d '' dest; then
          CHANGED_FILES+=("$dest")
        else
          # Fallback to first path if second not available
          CHANGED_FILES+=("$path")
        fi
        ;;
      *)
        CHANGED_FILES+=("$path")
        ;;
    esac
  done < <(git status --porcelain -z 2>/dev/null || true)
fi

# Dedupe and keep only existing regular files
if [[ ${#CHANGED_FILES[@]} -gt 0 ]]; then
  IFS=$'\n' read -r -d '' -a CHANGED_FILES < <(printf '%s\0' "${CHANGED_FILES[@]}" | sort -zu && printf '\0') || true
fi

FILTERED_FILES=()
for file in "${CHANGED_FILES[@]:-}"; do
  [[ -f "$file" ]] || continue
  if ! is_excluded "$file"; then
    FILTERED_FILES+=("$file")
  fi
done

# Copy changed files to staging
echo "  Copying changed files..."
for file in "${FILTERED_FILES[@]:-}"; do
  dirpath="$(dirname "$file")"
  mkdir -p "$STAGING_DIR/$dirpath"
  cp -p "$file" "$STAGING_DIR/$file"
done

# Always include metadata files if present
echo "  Adding metadata files..."
for file in "${ALWAYS_INCLUDE[@]}"; do
  if [[ -f "$file" ]]; then
    dirpath="$(dirname "$file")"
    mkdir -p "$STAGING_DIR/$dirpath"
    cp -p "$file" "$STAGING_DIR/$file" 2>/dev/null || true
  fi
done

# Include next.config.* files up to depth
find . -maxdepth "$NEXTCONFIG_DEPTH" -type f -name "next.config.*" \
  ! -path "*/node_modules/*" ! -path "*/.git/*" | while IFS= read -r f; do
    rel="${f#./}"
    mkdir -p "$STAGING_DIR/$(dirname "$rel")"
    cp -p "$f" "$STAGING_DIR/$rel" 2>/dev/null || true
  done

# Generate patch file
echo "  Generating patch file..."
if [[ "$INCLUDE_WORK" == true ]]; then
  {
    git diff --binary "$BASE_REF"...HEAD 2>/dev/null || true
    git diff --binary 2>/dev/null || true
  } > "$STAGING_DIR/patch.diff"
else
  git diff --binary "$BASE_REF"...HEAD > "$STAGING_DIR/patch.diff" 2>/dev/null || true
fi
# If empty, annotate for reviewers
[[ -s "$STAGING_DIR/patch.diff" ]] || echo "# no diff between $BASE_REF and HEAD" > "$STAGING_DIR/patch.diff"

# Generate summary
echo "  Generating summary..."
SUMMARY_FILE="$STAGING_DIR/summary.txt"
{
  echo "=== Git Diff Export Summary ==="
  echo
  echo "Repository: $REPO_NAME"
  echo "Current Branch: $CURRENT_BRANCH"
  echo "Base Ref: $BASE_REF"
  echo "Base Commit: $(git rev-parse "$BASE_REF" 2>/dev/null || echo unknown)"
  echo "Head Commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo

  echo "=== Diff Statistics ==="
  git diff --shortstat "$BASE_REF"...HEAD 2>/dev/null || echo "No committed changes"
  echo

  if [[ "$INCLUDE_WORK" == true ]]; then
    echo "=== Working Tree Status (porcelain v2) ==="
    git status --porcelain=v2 2>/dev/null || git status --porcelain 2>/dev/null || echo "No working tree changes"
    echo
  fi

  echo "=== Top 20 Largest Changed Files ==="
  {
    for f in "${FILTERED_FILES[@]:-}"; do
      [[ -f "$f" ]] || continue
      size="$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo 0)"
      echo "$size $f"
    done
  } | sort -rn | head -20 | while read -r size f; do
      if command -v numfmt >/dev/null 2>&1; then
        human="$(numfmt --to=iec-i --suffix=B "$size" 2>/dev/null || echo "${size}B")"
      else
        human="${size}B"
      fi
      echo "  $human - $f"
    done
  echo

  # Changed packages
  PACKAGE_FILES=()
  for f in "${FILTERED_FILES[@]:-}"; do
    if [[ "$f" == */package.json || "$f" == "package.json" ]]; then
      PACKAGE_FILES+=("$f")
    fi
  done
  if [[ ${#PACKAGE_FILES[@]} -gt 0 ]]; then
    echo "=== Changed Packages ==="
    for pkgf in "${PACKAGE_FILES[@]}"; do
      if [[ -f "$pkgf" ]]; then
        name="$(grep -m1 -E '"name"\s*:' "$pkgf" 2>/dev/null | sed -E 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || echo "$pkgf")"
        echo "  - $name ($pkgf)"
      fi
    done
    echo
  fi

  if [[ -f "nx.json" ]]; then
    echo "=== Nx Workspace Information ==="
    if command -v nx >/dev/null 2>&1; then
      nx show projects 2>/dev/null | head -20 || echo "  (Unable to list projects)"
    else
      echo "  Nx detected but 'nx' command not available"
    fi
    echo
  fi

  echo "=== Export Information ==="
  echo "Generated: $(date)"
  echo "Changed Files Count: ${#FILTERED_FILES[@]}"
} > "$SUMMARY_FILE"

# Generate manifest with SHA256
echo "  Generating manifest..."
(
  cd "$STAGING_DIR"
  {
    echo "SHA256 Checksums"
    echo "================"
    echo
    # Include every file in staging, so reviewers can verify integrity
    while IFS= read -r -d '' f; do
      rel="${f#./}"
      if command -v shasum >/dev/null 2>&1; then
        hash="$(shasum -a 256 "$f" 2>/dev/null | cut -d' ' -f1)"
      elif command -v sha256sum >/dev/null 2>&1; then
        hash="$(sha256sum "$f" 2>/dev/null | cut -d' ' -f1)"
      else
        hash="(checksum tool not available)"
      fi
      echo "$hash  $rel"
    done < <(find . -type f -print0 | sort -z)
  } > manifest.txt
)

# Create archive
echo "  Creating archive..."
ARCHIVE_PATH="$OUTPUT_PATH"
(
  cd "$STAGING_DIR"
  if command -v zip >/dev/null 2>&1; then
    zip -rq "$ARCHIVE_PATH" . -x "*.DS_Store" || {
      echo -e "${RED}Error: Failed to create zip archive${NC}" >&2
      exit 1
    }
  else
    # Fallback to tar.gz
    ARCHIVE_PATH="${ARCHIVE_PATH%.zip}.tar.gz"
    tar -czf "$ARCHIVE_PATH" . 2>/dev/null || {
      echo -e "${RED}Error: neither zip nor tar.gz succeeded${NC}" >&2
      exit 1
    }
  fi
)

ABS_ARCHIVE_PATH="$(cd "$(dirname "$ARCHIVE_PATH")" && pwd)/$(basename "$ARCHIVE_PATH")"

# Count all files included in the archive by counting staging files
TOTAL_IN_STAGING="$(find "$STAGING_DIR" -type f | wc -l | tr -d ' ')"

echo -e "${GREEN}✓ Archive created successfully${NC}"
echo
echo "Archive: $ABS_ARCHIVE_PATH"
echo "Changed files copied: ${#FILTERED_FILES[@]}"
echo "Total files in archive: $TOTAL_IN_STAGING"
if [[ -f "$ABS_ARCHIVE_PATH" ]]; then
  if command -v du >/dev/null 2>&1; then
    echo "Size: $(du -h "$ABS_ARCHIVE_PATH" | cut -f1)"
  fi
fi

# End of script
