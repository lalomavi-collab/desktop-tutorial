#!/bin/bash
# Send a social media post via GitHub Actions workflow
# Usage: ./scripts/send_post.sh <platform> <message>
# Platform: facebook | telegram | linkedin | all

PLATFORM="${1:-facebook}"
MESSAGE="${2:-Test post from Prompt Builder Agent}"
REPO="lalomavi-collab/desktop-tutorial"

echo "Sending post to: $PLATFORM"
echo "Message: $MESSAGE"
echo ""

gh workflow run "send-post.yml" \
  --repo "$REPO" \
  --ref "main" \
  -f platform="$PLATFORM" \
  -f message="$MESSAGE"

echo ""
echo "Workflow triggered! Check status:"
echo "  gh run list --repo $REPO --workflow send-post.yml --limit 1"
