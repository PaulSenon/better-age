#!/bin/sh
# Fake $EDITOR for E2E. Asserts it owns the terminal (its process group is the
# tty's foreground group, like vim/nano need), then replaces the file with
# $BAGE_E2E_TEXT, or sleeps to simulate an editor the user interrupts.
file="$1"
read -r _ _ _ _ pgrp _ _ tpgid _ < /proc/$$/stat
if [ "$pgrp" != "$tpgid" ]; then
	echo "fake-editor: not in the terminal foreground (pgrp=$pgrp tpgid=$tpgid)" >&2
	exit 3
fi
echo "fake-editor: editing" >&2
if [ -n "$BAGE_E2E_EDITOR_SLEEP" ]; then
	sleep "$BAGE_E2E_EDITOR_SLEEP"
fi
if [ -n "$BAGE_E2E_TEXT" ]; then
	printf '%s' "$BAGE_E2E_TEXT" > "$file"
fi
