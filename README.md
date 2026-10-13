# MED-LAB ZERO

**Laboratorium riset sinyal berbasis HP Android, gratis, bukan alat medis.**

**[Buka aplikasi di Chrome Android](https://yusufsalahamana.github.io/Medlab-zero/)**

Tidak perlu akun, Termux, Python, laptop, API berbayar, atau perangkat tambahan. Repo sudah publik dan GitHub Pages aktif. Ringkasan eksperimen motorik disimpan di browser; frame/gelombang/kandidat kamera hanya di memori dan tidak diekspor. Aplikasi tidak mengunggah pengukuran.

## Eksperimen

- Reaction Time: lima percobaan latensi sentuh.
- Finger Tapping: ritme ketukan selama 15 detik.
- Motion Lab: percepatan selama 12 detik, pemeriksaan laju sampel, spektrum eksploratif.
- Camera Pulse Lab (M1): 25 detik kamera belakang, ROI luminansi, QC, **experimental candidate pulse**. Angka hanya kandidat pola optik 45–180/menit, bukan denyut jantung tervalidasi. Tidak disimpan ke riwayat atau baseline.

- ReflexPrint (M2): sesi terpandu Reaksi → Ketukan → Gerak. Hanya sesi lengkap yang lolos QC disimpan sebagai satu ringkasan berantai; tidak ada skor kesehatan atau model AI. [Metode dan batas](docs/M2_REFLEXPRINT.md).

Modul motorik membandingkan 5–20 sesi valid terdahulu dengan median dan MAD. Perubahan statistik bukan indikator penyakit. ReflexPrint membandingkan fitur tiap sesi lengkap dengan 5–20 sesi terdahulu yang cocok pada protokol, tangan, posisi, browser/layar, metode input dan sumber akselerasi. Kamera tidak masuk perbandingan tersebut.

Buka tab **Metode** untuk **Periksa perangkat** (M3 setelah PR diterima): status API/izin/sampel/kamera/cache terpisah dan kartu uji HP opsional. Probe sensor/kamera hanya dimulai setelah tap, tidak disimpan, dan dihentikan saat batal/pindah/latar belakang. API tersedia atau cache ditemukan bukan bukti PASS Android fisik. Setelah hasil pemeriksaan **CACHE_READY**, aplikasi dapat diuji dengan mematikan jaringan dan membuka ulang URL. Instalasi PWA, kamera/lampu, sensor Android dan akurasi pada HP nyata tetap **UNVERIFIED**. Lihat [kartu uji Android](docs/ANDROID_TEST_PATH.md) dan [metode/batas kamera](docs/M1_CAMERA.md).

## Alur kerja `run`

- [HUB dan baton — Issue #1](https://github.com/yusufsalahamana/Medlab-zero/issues/1)
- [Instruksi semua room](AGENTS.md), [protokol peran](docs/RUN_ONLY.md), [setup room](docs/ROOM_START.md)
- [Batas ilmiah](docs/RESEARCH_GATES.md)

WORK satu-satunya penulis kode; Auditor memeriksa SHA tepat; Director menerima/merge setelah audit dan CI. Komunikasi melalui GitHub, tanpa pemindahan baton manual. Room yang tidak aktif tidak otomatis berjalan.

## Pengujian untuk pengembang

```bash
node --check device-check.js
node --check app.js
node --check analysis.js
node --check reflex.js
node --check pulse.js
node --check camera.js
node --check service-worker.js
node --test tests/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

CI juga menjalankan Chromium localhost dengan input sintetis dan cache offline (`tools/browser-smoke.cjs` dan `tools/reflex-browser-smoke.cjs`), serta job terpisah yang membuka situs Pages publik dan aset yang benar-benar terdeploy (`tools/live-pages-smoke.cjs`). Tes situs live membuktikan versi publik saat job berjalan, bukan deployment branch PR. Mobile viewport/sumber sintetis tidak membuktikan penggunaan hardware Android.

[Catatan impor M0](docs/M0_TEST_REPORT.md) adalah bukti historis, termasuk jalur privat sebelum repo dipublikasikan. Server loopback dan paket CI tetap tersedia untuk pengembang, bukan syarat pengguna.

Tidak ada diagnosis, pengukuran tekanan darah/glukosa/SpO2, reassurance janin atau klaim AI tervalidasi. Jangan gunakan hasil untuk keputusan klinis. Jangan unggah pengukuran pribadi ke GitHub/Drive. Pengeluaran, perubahan akses dan unggahan data pasien memerlukan izin khusus.
