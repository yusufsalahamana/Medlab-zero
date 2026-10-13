# M2 ReflexPrint — pattern riset tugas motorik personal

Sesi opt-in sekitar 1–2 menit, maksimum 5 menit: Reaction Time (5 percobaan) → Finger Tapping (15 detik) → Motion Lab (12 detik, duduk dengan lengan ditopang). Memakai komponen yang ada, tanpa akun, hardware tambahan, backend, pembayaran atau model AI. Kamera tidak masuk sesi ini.

## Satu sesi lengkap, satu record lokal

Pilih tangan dan konfirmasi HP/posisi yang sama. Saat tiap tahap benar-benar mulai menangkap input, catat waktu awal/akhir wall-clock, durasi `performance.now`, serta konteks browser/layar. Waktu menunggu izin sensor tidak disebut durasi pengukuran. Tahap disimpan sementara di memori, kemudian satu record `type=reflex` ditulis ke key riwayat yang sama **hanya setelah seluruh tahap lengkap dan valid**. Record memuat ringkasan per modality, QC, sumber sensor/input, protokol, urutan dan timing. Modul tunggal tetap menyimpan record tunggal seperti sebelumnya.

Tidak menyatukan hasil acak dari hari berbeda menjadi profil “simultan”; tiga tahap berlangsung berurutan, bukan simultan. Metadata sumber akselerasi adalah `acceleration` atau `includes-gravity`; waktu sampel gerak adalah waktu penerimaan browser, bukan klaim timestamp hardware. Latensi sentuh mencakup rendering, layar, browser dan tindakan manusia; bukan waktu respons saraf murni.

Tutup, pindah menu/modul, latar belakang atau `pagehide`: batalkan dan buang semua tahap parsial. QC gagal tidak membuat record valid. Izin sensor ditolak/tidak tersedia tidak menyimpan hasil parsial; pengguna dapat mencoba izin lagi atau membatalkan. Kegagalan `setItem` mempertahankan riwayat/counter/reference/ekspor lama; hasil lengkap ditampilkan sementara dengan tombol coba simpan ulang yang tidak menduplikasi record. Setelah meninggalkan eksperimen, hasil gagal-simpan tersebut dibuang. Penghapusan yang gagal mempertahankan riwayat dan melaporkan error.

JSON mempertahankan struktur sesi berantai; CSV menambah fitur, konteks, QC/source, awal/akhir/durasi tiap tahap dan laju/jumlah sampel gerak. Key/schema riwayat lama tetap kompatibel. Tidak ada impor otomatis lintas perangkat. Tidak ada penyimpanan/export raw motion, frame kamera, audio atau raw timestamp sentuhan. Tidak ada endpoint upload atau analytics; jangan kirim riwayat pribadi ke GitHub/Drive.

## Gate kualitas dan comparability

- Reaksi: lima trial valid (100–3000 ms), satu metode input; durasi capture 1–180 detik.
- Ketukan: ≥3 ketukan pada window 15 detik; durasi capture 14,9–20 detik. Metode input reaksi/ketukan harus sama (`pointer` atau `keyboard`).
- Gerak: QC M0 (≥8 detik, ≥160 sampel, ≥28 Hz), ditambah timestamp monoton/finite, gap ≤250 ms, CV interval ≤0,35, missing samples ≤5%, satu sumber akselerasi konsisten. Durasi capture 8–16 detik. Tidak berarti sensor/pose sudah tervalidasi.
- Urutan/timing tahap harus konsisten, tidak overlap; wall-clock dan monotonic duration berbeda ≤1 detik. Perubahan browser/layar selama capture atau antar tahap menolak sesi. Total elapsed maksimum 5 menit; ulangi dari awal jika terlampaui.
- Reference: hanya record lengkap, valid, protokol v1, urutan yang sama, tangan/posisi, tanda browser+layar, metode input serta sumber akselerasi yang sama. Exclude record sendiri/future/overlap dan duplikat ID. Urutkan waktu, pilih paling banyak 20 sesi terdahulu.

Tanda konteks berupa user agent, dimensi layar dan pixel ratio, disimpan lokal. Ini **bukan identitas hardware yang unik**: dua HP dapat mempunyai tanda yang sama; konfirmasi pengguna tetap diperlukan. Browser update, orientasi atau metode sensor berubah dapat membuat reference tidak sebanding. Posisi/tangan adalah deklarasi pengguna, bukan pose yang dibuktikan sensor. Tidak ada validasi fisiologis dari QC ini.

## Statistik transparan

Sebelum 5 sesi terdahulu sebanding: tampilkan `Data tidak mencukupi`, jumlah n/5, tanpa deviasi. Setelah cukup, per fitur latensi sentuh median (ms), ketukan/detik, RMS gerak dinamis (m/s²):

`center = median(x)`

`MAD = median(|x - center|)`

`spread = max(1.4826 × MAD, |center| × 0.05, absolute_floor)`

Absolute floor: 8 ms, 0,1 ketuk/detik, 0,01 m/s². Zero MAD tetap menghasilkan spread positif. `z = (current - center)/spread`. Rentang eksploratif `median ±2,5 spread` (batas bawah minimum nol). Ini guard/heuristik, **bukan interval kepercayaan, reference klinis, rentang sehat/sakit, probabilitas penyakit atau cutoff tervalidasi**. Sesi saat ini tidak masuk reference-nya sendiri. |z|>2,5 hanya menyatakan perbedaan terhadap pola sebelumnya dan menyarankan cek teknik. Tidak ada skor gabungan/anomaly model/AI, kausalitas atau diagnosis.

Rolling 20 sesi dapat bergeser bersama latihan/kondisi/perangkat. Sampel personal kecil, selection bias dan covariates lain (waktu, tidur, obat, fatigue) tidak dimodelkan. Tidak membuktikan biomarker baru atau kebaruan paten. Tidak menyimpulkan penyakit, kehamilan, kardiovaskular, BP/glukosa/SpO2/ECG/HRV atau keputusan medis.

## Bukti otomatis dan batas

Pure fixtures mencakup incomplete/nonfinite data, outlier, zero MAD, small N, temporal drift, source/context mismatch, self/future/duplicate exclusion. DOM harness menjalankan capture terpandu, pembatalan/izin, gagal save/retry tanpa duplikasi, gagal delete/retry, JSON/CSV, enam sesi berulang dan comparison tanpa leakage. Tes M0/M1 tetap dipertahankan.

`node --test tests/*.test.js` dan `python3 -m unittest discover -s tests -p 'test_*.py' -v` adalah tes sintetis/Linux. `tools/reflex-browser-smoke.cjs` menguji DOM Chromium mobile viewport dengan input pointer dan DeviceMotion **sintetis**, lima linked fixtures sebelumnya, partial cancel/restart, save denial/retry, comparison, export/delete dan offline cache. Job live Pages terpisah menguji main yang terdeploy, bukan deployment PR. Hasil nyata pada exact PR HEAD dicatat di PR/HUB; skrip yang ada tidak otomatis berarti PASS.

Chromium lokal belum tersedia di runtime ini, sehingga tidak ada klaim PASS lokal. Browser dijalankan pada GitHub CI. Real Android sensor/source/timing, kamera/torch, PWA install/offline fisik, repeatability terhadap pengguna nyata dan clinical validity tetap **UNVERIFIED**. Tidak diperlukan langkah fisik pengguna untuk menyelesaikan patch riset ini.
