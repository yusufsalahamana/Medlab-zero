# MED-LAB ZERO

**Free Android-only physiological signal research laboratory (NOT a medical device).**

## Start here — user only types `run`
- [RUN hub / shared baton — Issue #1](https://github.com/yusufsalahamana/Medlab-zero/issues/1)
- [Instructions for all AI rooms](AGENTS.md)
- [RUN-ONLY protocol / role permissions](docs/RUN_ONLY.md)
- [One-time setup for Director, Work Executor and Auditor](docs/ROOM_START.md)
- [Scientific and safety gates](docs/RESEARCH_GATES.md)

## Prototype v0.1
Source imported from the existing `medlab-zero-v0.1.zip`: five-trial reaction time, 15-second finger tapping, 12-second motion capture with basic QC, personal statistical baseline, local history and JSON/CSV export. No trained AI model or clinical interpretation is implemented. Camera/PPG is not implemented in M0.

Open `index.html` for reaction/tapping, or run `python3 tools/serve.py` and open `http://127.0.0.1:8765/` on the same device. Motion availability requires a secure context, browser support and permission. PWA caching is registered on secure localhost HTTP or HTTPS; installation and actual offline use on Android remain unverified. See the [private Android test path](docs/ANDROID_TEST_PATH.md). Hosting must follow the approval policy below.

```bash
node --check app.js
node --check analysis.js
node --check service-worker.js
node --test tests/*.test.js
```

See [M0 test evidence and limitations](docs/M0_TEST_REPORT.md). No public deployment or Android field-test PASS is claimed.

## Work queue
- [#2 M0: source import and automated tests](https://github.com/yusufsalahamana/Medlab-zero/issues/2)
- [#3 M0: Android tests + independent audit](https://github.com/yusufsalahamana/Medlab-zero/issues/3)
- [#4 M1: camera PPG pulse research](https://github.com/yusufsalahamana/Medlab-zero/issues/4)

## Rules
One app-code writer at a time (WORK), GitHub Issues/PRs as inter-room communication, no repeated copy-pasting baton. Direct normal tasks via `run`, which makes each room re-read the latest HUB. An inactive ChatGPT room is **not** automatically started by other rooms. Routine non-sensitive repo work may proceed; no public deployment, access/privacy changes, paid spending or real patient data upload without specific approval.

No medical diagnosis, blood pressure/glucose/SpO2 measurement, fetal reassurance or claims of validated AI. Record unverified tests as **UNVERIFIED**, not PASS. Local-only data by default.

