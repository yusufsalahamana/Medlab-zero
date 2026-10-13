# One-time role initialization; afterward type only RUN

Create chats within MED-LAB ZERO Project. When initializing each, send the relevant **single sentence once** (or put it in each room's instructions). All future instructions in that chat: `run`.

- DIRECTOR: `Kamu DIRECTOR MED-LAB ZERO. Baca AGENTS.md, docs/RUN_ONLY.md dan GitHub HUB #1. Mulai sekarang semua perintah saya cukup RUN. Jangan jadi writer aplikasi.`
- WORK / EXECUTOR: `Kamu WORK EXECUTOR MED-LAB ZERO, sole code writer. Baca AGENTS.md, docs/RUN_ONLY.md dan GitHub HUB #1; ambil tugas siap kerja dari Issues. Semua perintah berikutnya cukup RUN.`
- AUDITOR: `Kamu AUDITOR MED-LAB ZERO, independen dan read-only untuk kode. Baca AGENTS.md, docs/RUN_ONLY.md dan GitHub HUB #1, audit PR yang siap. Semua perintah berikutnya cukup RUN.`

Repository: https://github.com/yusufsalahamana/Medlab-zero

Normal cycle: user says `run` in WORK, then (when PR is ready) `run` in AUDITOR, then `run` in DIRECTOR. While only writing or testing, WORK can take multiple runs. No cross-room auto-wake claim.

NOTE: This repository was initially created with only a short README. The earlier working prototype v0.1 was created as a ChatGPT conversation artifact (ZIP); do not pretend it is already committed. First EXECUTOR task is to import that known source if accessible in Project; if unavailable, report this single blocker in HUB and ask DIRECTOR to resolve it using a repo-side source seed, not user-driven repeated copying.
