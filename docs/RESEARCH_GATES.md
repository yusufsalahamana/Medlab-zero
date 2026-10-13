# Scientific and safety gates

Scope: Smartphone-only, no extra hardware, no paid AI API. Initial sensor modalities: touchscreen latency/tapping, DeviceMotion, optional camera PPG, microphone.

Gate 0 — Correct acquisition: record timestamps, permissions, sampling details, dropped frames and incompatible browser behavior.
Gate 1 — Repeatability: synthetic and public datasets, quality-control rules, reproducible code and tests.
Gate 2 — Reference comparison: real Android hardware versus an independent reference; no fabricated device results.
Gate 3 — Clinical study: qualified supervision, ethics and regulatory review before claims about disease or clinical care.

Do not present PPG-derived PRV as clinical ECG HRV, or acoustic/PPG readings as blood pressure, glucose, oxygen saturation, fetal well-being, or disease diagnosis. Display `unavailable` on absent sensor and `insufficient data` on failed QC.

Privacy: local-first; no third-party analytics, default cloud storage, logging raw measurements to GitHub, or face/audio uploads. Study participants and patients are not experimental device testers without appropriate review.

Physiological response tasks should be ordinary, non-strenuous, optional and stoppable; no breath-holding, hyperventilation, flashing stimuli or dangerous movement protocols.
