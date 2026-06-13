#!/usr/bin/env bash
# fleet-grid.sh — baut/refresht eine tmux-"Video-Wall" aller Peer-Sessions in EINEM Fenster,
# gekachelt, READ-ONLY (nested attach mit -r). ttyd serviert sie im Browser (1 Link).
# Baustein 2 (T-0204, Schraubi). INSTALL-READY DRAFT — laeuft im Ziel-LXC nach Migration.
#
# Funktionsweise: pro laufender 'peer-*'-tmux-Session ein Pane, das die Session read-only
# spiegelt ('tmux attach -t <session> -r'). Aussen-Session 'fleetgrid' wird von ttyd ebenfalls
# read-only serviert -> Christin schaut nur zu, kann nichts eintippen (doppelt abgesichert:
# tmux -r INNEN + ttyd ohne -W AUSSEN).
set -euo pipefail

GRID="fleetgrid"
# Welche Sessions ins Grid? Default: alle peer-* + die Kern-Dienste-Sessions.
PATTERN="${1:-^(peer-|spawner|telegram-bridge|sentinel-receiver)}"

mapfile -t SESSIONS < <(tmux ls -F '#{session_name}' 2>/dev/null | grep -E "$PATTERN" | grep -v "^${GRID}$" | sort)
if [ "${#SESSIONS[@]}" -eq 0 ]; then echo "keine Peer-Sessions gefunden"; exit 1; fi

# Grid frisch aufbauen (idempotent)
tmux kill-session -t "$GRID" 2>/dev/null || true
tmux new-session -d -s "$GRID" -n wall "tmux attach -t '${SESSIONS[0]}' -r"
for s in "${SESSIONS[@]:1}"; do
  tmux split-window -t "$GRID":wall "tmux attach -t '$s' -r"
  tmux select-layout -t "$GRID":wall tiled >/dev/null
done
tmux select-layout -t "$GRID":wall tiled >/dev/null
# Panes leicht beschriften (Session-Name als Pane-Title; nur Anzeige)
tmux set -t "$GRID" -g pane-border-status top 2>/dev/null || true
tmux set -t "$GRID" -g pane-border-format " #{pane_index} #{pane_title} " 2>/dev/null || true
echo "fleetgrid neu aufgebaut mit ${#SESSIONS[@]} Panes: ${SESSIONS[*]}"
