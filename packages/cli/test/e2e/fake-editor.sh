#!/bin/sh
# Fake $EDITOR for E2E: replaces the file with $BAGE_E2E_TEXT (if set), or
# sleeps to simulate a long-running editor that the user interrupts.
file="$1"
echo "fake-editor: editing" >&2
if [ -n "$BAGE_E2E_EDITOR_SLEEP" ]; then
	sleep "$BAGE_E2E_EDITOR_SLEEP"
fi
if [ -n "$BAGE_E2E_TEXT" ]; then
	printf '%s' "$BAGE_E2E_TEXT" > "$file"
fi
