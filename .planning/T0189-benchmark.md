# T-0189 — Modell-Benchmark Sonnet vs Haiku vs MiniMax-M3 (Tiering)

**Stand:** 2026-06-12 · **Methode:** 6 Delegations-Task-Typen über das LLM-Gateway
(`/api/llm/complete`, `cache:false`), Latenz gemessen, deterministische Tasks exact-graded.

## Roh-Ergebnis (Latenz ms / Korrektheit)

| Task | Haiku | Sonnet | MiniMax-M3 |
|---|---|---|---|
| classify (bug/feat/q) | 5012 ✓ | 2898 ✓ | 1758→3442 ✓ |
| extract JSON | 4849 ✓ | 4094 ✓ | 2796✗(low)→3376 ✓ |
| vendor-detect | 8380 ✓ | 2797 ✓ | 2557 ✓ |
| summarize (DE) | 11483 | 8320 | 2233 |
| german_ui (translate) | 5363 | 3339 | 3044 |
| commit-msg | 13438 | 2987 | 2645 |

Korrektheit deterministisch (classify/extract/vendor): **alle 3 = 100%**, sobald M3
genug max_tokens hat. Generative (summarize/german_ui/commit): alle 3 inhaltlich korrekt;
Sonnet das sauberste Deutsch + reinste Struktur (kein ```json-Fence wie Haiku).

## Zwei harte M3-Befunde (actionable)

1. **M3 braucht `max_tokens ≥ ~1024`.** M3 ist ein Reasoning-Modell und emittiert
   `<think>…</think>` VOR der Antwort. Bei `max_tokens` 15–80 (typisch für Klassifikation)
   wird der Reasoning-Block abgeschnitten → **nur Think, keine Antwort** (extract_json fiel
   bei max_tokens=40 auf ✗, bei 2048 auf ✓). Das Gateway bumpt Template-`max_tokens` auf
   ≥4096, aber **NICHT bei direkten `model:"minimax:*"`-Calls** → Caller müssen selbst ≥1024 setzen.
2. **Non-Stream-Pfad leakt `<think>…</think>`** im `text`-Feld (der Streaming-Pfad strippt
   es via State-Machine, Non-Stream liest nur `reasoning_content`, das MiniMax nicht füllt).
   → Direkter Non-Stream-M3-Output muss vom Caller gestrippt werden, ODER Templates/Streaming nutzen.

## Latenz-Einordnung (wichtig fürs Tiering)
- **Haiku/Sonnet-Latenz ist CLI-Cold-Start-dominiert** (3–13 s), NICHT Modell-Geschwindigkeit.
  Warm/gecacht sind beide schnell. Der erste Call je Modell trägt die Cold-Start-Kosten
  (Haiku classify $0,033 vs. warm ~$0,004; Sonnet classify $0,091 vs. warm ~$0,008).
- **M3 hat KEINEN CLI-Cold-Start** (reiner HTTP-API-Call) → konstant ~2–3,5 s, und **$0 gegen
  den Anthropic-Plan** (eigener Backend-Pool).

## Tiering-Empfehlung

| Aufgabe | Empfohlenes Modell | Warum |
|---|---|---|
| Bulk-Klassifikation / Triage / Extraktion (latenz-tolerant, Quota schonen) | **MiniMax-M3** (max_tokens≥1024 + think-strip, oder Template) | $0 Anthropic-Quota, korrekt, schnell ohne Cold-Start |
| Klassifikation/Extraktion klein + sofort, Deutsch egal | **Haiku** | billigster Anthropic-Tier, gecacht instant |
| Saubere Struktur (JSON ohne Fences), gutes Deutsch, operator-nah | **Sonnet** (Default) | reinste Formatierung, bestes Deutsch, schnell warm |
| Architektur/Tradeoffs/Multi-Step/Code-Gen | **Opus** (nicht delegieren) | nicht Teil dieses Benchmarks; bleibt beim Agenten |

**Kern: M3-Tiering für „triviale Delegation" ausweiten** (Klassifikation, Extraktion,
Summary, Translation, commit-msg, vendor-detect) — genau der Quota-Schon-Niche. Die 3
Templates commit-msg/log-summary/vendor-detect routen schon auf ein externes Backend; M3
passt in dieselbe Kategorie.

## Zwei Gateway-Verbesserungen (Vorschlag an Hub)
1. **Bei direkten `model:"minimax:*"`-Calls `max_tokens` auf ≥1024 anheben** (wie bei Templates),
   sonst Reasoning-Truncation → leere Antworten. Kleiner Guard im Gateway, hoher Nutzen.
2. **`<think>`-Strip in den Non-Stream-Parse-Pfad ziehen** (Streaming hat ihn schon). Macht M3
   für alle Non-Stream-Caller ohne Eigen-Strip nutzbar.
