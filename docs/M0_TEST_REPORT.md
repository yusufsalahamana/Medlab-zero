# M0 source import — Issue #2

## Provenance and scope

Imported the existing `medlab-zero-v0.1.zip`, not a reconstruction from conversation memory. Kept application assets, numerical tests and the test workflow. Excluded the ZIP's obsolete README, role prompts, BATON, runbook, backlog and prior test report. Repository AGENTS.md, RUN_ONLY.md, ROOM_START.md and RESEARCH_GATES.md remain unchanged.

Bootstrap fixes: reset each reaction onset and guard late animation callbacks; prevent delayed motion permission from starting a closed experiment; cancel backgrounded experiments and prevent stale handlers from saving results; keep sensor preview traces out of persisted/exported history; retain the storage-failure message; isolate service-worker cache lookup/deletion to this application.

## Executed checks (2026-10-13)

Local runtime: Node v24.19.0. The GitHub workflow uses Node 22; its execution/result must be checked independently at the PR SHA.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| `node --check app.js` | PASS | Syntax only |
| `node --check analysis.js` | PASS | Syntax only |
| `node --check service-worker.js` | PASS | Syntax only |
| `node --test tests/*.test.js` | PASS, 16/16 | Six original numerical tests, seven app simulations, three PWA simulations |
| Manifest / cache asset paths | PASS | Files exist, relative paths resolve under a subpath; simulated offline cached asset |
| Local save / reload / JSON / CSV / delete | PASS in simulation | Synthetic sessions only; denied storage reports failure |
| Sensor absent / insecure / denied / pending permission / zero samples | PASS in simulation | No invented device measurements; pending permission cannot revive a canceled run |
| Synthetic motion input | PASS | 6 Hz fixture passes basic QC; preview samples/trace absent from stored JSON |
| UI browser smoke | UNVERIFIED | Playwright launch failed: Chromium executable is not installed; no browser interaction performed |
| Real Android / installed PWA offline | UNVERIFIED | Requires physical device and approved HTTPS access |

The Node DOM/event and Cache API harnesses are deliberately small simulations, not browser conformance or real-device tests. No assertion about clinical validity follows from these checks.

## Privacy and capability inspection

- All runtime scripts/styles/icons are local. No analytics, remote SDK, upload endpoint, camera or microphone request is present. Network use consists of same-origin application asset loading/cache misses; no code sends measurement history to a server.
- Summaries are stored in localStorage; in-memory motion samples supply the preview only. Exports are explicit local downloads. Anyone with access to the browser profile can read its history; clearing site data removes it.
- Research-only text is visible in the notice, method and footer. No BP/glucose/SpO2, diagnosis, fetal assessment, clinical tremor grade or trained-AI output exists.
- QC rejects absent/invalid/short/low-rate motion data. It uses average sample density and does not yet detect every sampling gap, artifact, irregularity or aliasing condition. Spectral features and personal baselines are exploratory. Reaction includes screen, scheduling and input latency.
- The manifest has an SVG icon. Installation acceptance, icon rendering and service-worker behavior on actual Android Chrome still require device verification.

## Future Android test card (Issue #3)

Use only after a Director-approved HTTPS path is available. Report browser/device version and PASS/FAIL observations; do not upload personal measurements or raw recordings to GitHub.

1. Run five reaction trials (including an early touch), then tapping for 15 seconds. Check results, local reload, JSON/CSV download and deletion. Background a running test: it must cancel without saving.
2. Run Motion Lab for 12 seconds. Check permission refusal/unavailability where possible; successful capture must show actual sample count/rate, while unavailable or insufficient samples must remain invalid. Close while a permission prompt is pending: granting afterward must not start capture.
3. Load over HTTPS, attempt installation, reopen in airplane mode and repeat reaction/tapping; check offline assets and local history. Record installation/offline failures honestly.

This card is pending, not an instruction to publish the repository. Public release is not authorized. Independent Auditor review and Director acceptance/merge remain required.
