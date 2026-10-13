# M1 Camera Pulse Lab — metode dan bukti

Eksperimen optik lokal, bukan alat medis. Tombol kamera meminta video belakang (preferensi environment), tanpa audio. ROI pusat 30% pada video diturunkan ke 32×32 piksel; luminansi rata-rata menghasilkan deret waktu. Frame hanya diproses di memori. Tidak ada localStorage, ekspor, baseline, request upload, atau penyimpanan frame/gelombang/kandidat kamera.

## Akuisisi dan pembatalan

Rekam 25 detik memakai timestamp `presentationTime` dari `requestVideoFrameCallback`. Frame unik dibedakan dengan `presentedFrames`; fallback RAF memakai hitungan decoded frames `getVideoPlaybackQuality().totalVideoFrames`, bukan `currentTime` yang dapat maju saat frame berulang. Browser tanpa hitungan frame yang tersedia gagal tertutup. Timestamp browser bukan bukti waktu paparan sensor yang akurat.

Torch dicoba hanya jika track menyatakan dukungan. Tidak tersedia/gagal: tampilkan keterbatasan dan gunakan QC yang sama. Pencahayaan alami mungkin tidak menghasilkan sinyal yang cukup. Tidak ada janji angka bila kamera/lampu tidak mendukung. Kamera dihentikan dan buffer dibersihkan saat selesai, gagal, dibatalkan, pindah tab/modul, `visibilitychange` atau `pagehide`; stream yang datang setelah pembatalan langsung dihentikan. Watchdog 45 detik membatasi dialog/start/frame yang terhenti. Dialog izin browser yang masih pending tidak bisa dibatalkan lewat API; jawaban terlambat tidak memulai rekaman.

## QC dan estimator eksploratif

| Pemeriksaan | Aturan |
| --- | --- |
| Akuisisi | ≥400 sampel, timestamp monoton/finite; 20–35 detik, 20–120 Hz |
| Timing | Jeda maksimum 250 ms; CV interval ≤0,25; paling banyak 2% interval >1,8× median |
| Exposure | Luminansi rata-rata 15–240; ≤2% sampel pada ≤5/≥250; setiap ROI ≤10% piksel jenuh |
| Flatline | SD luminansi ≥0,2 dan SD/rata-rata ≥0,001 |
| Lompatan | Selisih frame bertetangga ≤maks(8, 5×SD) |
| Periodisitas | Proyeksi harmonik dengan Hann pada 0,75–3 Hz, langkah 0,01 Hz; share energi sekitar puncak ±0,12 Hz ≥0,65 |
| Keterulangan | Autokorelasi satu periode ≥0,65; ≥12 puncak; CV interval ≤0,15; median interval dan puncak frekuensi sepakat dalam 6% |
| Stabilitas | Kedua setengah rekaman share ≥0,55 dan frekuensi berbeda ≤8% |

Setelah timing lolos, interpolasi ke 30 Hz; hilangkan drift linear dan baseline bergerak terpusat sekitar satu detik; rata-rata tiga titik, buang satu detik awal/akhir. Spektrum, autokorelasi dan interval puncak harus sepakat. Gagal QC: `candidateBpm=null`, tanpa gelombang hasil dan tanpa angka pengganti. Lolos: **experimental candidate pulse**, gelombang skala relatif, angka sementara.

Ambang tersebut adalah heuristik penelitian yang diuji sintetis, bukan standar klinis. Gerakan/pencahayaan periodik dapat lolos sebagai kandidat optik. Arah kamera adalah preferensi, pemilihan lensa/torch multi-camera tergantung browser. Harmonik/dicrotic notch, pengaturan exposure otomatis, warna kulit, tekanan jari, saturasi channel individual, pembuluh perifer, aritmia dan kondisi perangkat belum divalidasi. Range 45–180/menit membatasi pencarian pola; di luar range tidak disimpulkan normal/abnormal. Tidak menghitung HRV, BP, glukosa, SpO2, ECG, kehamilan atau diagnosis.

## Bukti yang dapat direproduksi

`node --test tests/*.test.js`: 41 tes saat implementasi awal. Enam pengujian M0 numerik, sebelas M0 aplikasi, tiga PWA tetap dipertahankan; ditambahkan dua puluh satu pengujian DSP, lifecycle kamera dan UI sementara. Sinyal sintetis 45, 60, 72, 90, 120, 150, 180/menit berada dalam toleransi 1,3/menit dengan noise kecil/drift/jitter; fixtures noise kuat, motion jump, dua frekuensi, flatline, exposure, sample rate rendah, gap/order dan pola berubah ditolak. Tes video sintetis melalui lifecycle juga memakai kuantisasi luminansi 8-bit.

`python3 -m unittest discover -s tests -p 'test_*.py' -v`: 3/3 PASS lokal; seluruh aset baru berada dalam allowlist server/paket. Syntax JS dan diff diperiksa. Hasil Chromium dan CI pada SHA tepat dicatat di PR/HUB setelah run; keberadaan skrip saja bukan PASS. Runtime lokal awal tidak mempunyai executable Chromium dan unduhan browser dibatasi jaringan; uji browser dilakukan melalui job GitHub CI, tanpa mengklaim PASS lokal.

Job localhost menguji kode PR dengan kamera canvas sintetis 90/menit, penolakan izin, buffer/track cleanup, no persistence dan regresi M0/cache. Job live-pages terpisah menguji Pages publik, aset dan cache versi yang terdeploy. Tidak membuktikan PR sudah live. Semua real Android camera/torch/DeviceMotion, instalasi/offline fisik dan akurasi terhadap referensi tetap **UNVERIFIED**.
