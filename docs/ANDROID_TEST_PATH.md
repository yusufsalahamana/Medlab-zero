# Satu uji Android opsional — tanpa unggahan data

Buka [MED-LAB ZERO](https://yusufsalahamana.github.io/Medlab-zero/) di Chrome Android. Tidak perlu akun, Termux, laptop, ZIP atau pembayaran. M0–M2 terdeploy; pemeriksaan perangkat M3 tersedia setelah PR diterima dan Pages diperbarui.

Di tab **Metode**, tap **Periksa perangkat & cache**. Ini hanya membaca kemampuan/cache, tidak meminta izin kamera/sensor. **Uji sensor 3 detik** dan **Uji akses kamera belakang** masing-masing meminta akses hanya setelah tap tersendiri; tombol batal, pindah menu, background dan pagehide menghentikan probe. Stream terlambat langsung dihentikan. Hasil probe tidak disimpan atau diunggah.

| Tindakan opsional | Observasi yang dicatat |
| --- | --- |
| Reaction + Tapping; muat ulang Riwayat; ReflexPrint berantai | Sesi lengkap disimpan satu kali; pembatalan/QC buruk tidak menyimpan sesi parsial. Bukan pengujian saraf/diagnosis. |
| Uji sensor, lalu Motion Lab | Bedakan API tersedia, izin GRANTED/DENIED/tidak ada hasil izin eksplisit, dan sampel teramati/data tidak cukup. Jangan melakukan gerakan yang dipaksakan. |
| Kamera ditolak; kamera diizinkan; batal/tutup Camera Pulse Lab | Pesan izin jujur; indikator kamera padam setelah stop. Probe tidak merekam frame/audio/torch; arah environment hanya metadata API. Batalkan bila lampu eksperimen panas. |
| Setelah CACHE_READY, mode pesawat, tutup/buka ulang Chrome pada URL sama | Aplikasi terbuka atau gagal. Uji tawaran instalasi Chrome secara terpisah; shortcut bukan bukti WebAPK. |

**Format laporan opsional:** `Model HP | versi Chrome | tindakan: PASS/FAIL/UNSUPPORTED | teks error`. Jangan kirim angka fisiologis, foto/screenshot, gelombang, raw sensor atau file ekspor. Tidak ada tombol kirim/telemetry dan tidak ada kewajiban melaporkan hasil untuk menyelesaikan pengerjaan kode.

**Makna status:** SUPPORTED hanya keberadaan API; GRANTED hanya jawaban browser; SAMPLES_OBSERVED hanya ≥40 event finite/monoton dan ≥28 Hz selama probe 3 detik (bukan QC lengkap Motion/ReflexPrint). ACCESS_OBSERVED hanya stream yang diperoleh lalu dihentikan; REAR_REPORTED hanya metadata facingMode environment. Cache siap memerlukan worker aktif/kontrol halaman dan semua aset dengan response sukses di satu cache lokal. OFFLINE_REPORTED hanya status jaringan browser. Tidak ada satu pun status tersebut otomatis membuktikan offline relaunch fisik, instalasi Android, kualitas/akurasi kamera/sensor atau clinical validity.

**Bukti otomatis terpisah:** Node menggunakan fixture/API mock sintetis; Python memeriksa loopback/paket Linux; Chromium memakai viewport mobile, pointer, motion events dan canvas/stream sintetis. Live Pages smoke menguji main yang sedang terdeploy, bukan branch PR. Hasil exact SHA/CI dicatat di PR/HUB. Semua real Android sensor/torch/timing, instalasi/offline setelah proses dihentikan dan akurasi tetap **UNVERIFIED** sampai ada pengujian fisik. Tidak ada klaim PASS Android dari simulasi.
