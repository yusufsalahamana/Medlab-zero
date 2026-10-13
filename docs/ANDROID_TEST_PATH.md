# Jalur uji Android privat — Issue #3

Jalur yang disiapkan: **Chrome + server 127.0.0.1 pada HP yang sama**, memakai Termux dan Python. Repo tetap privat; tidak ada deployment, komputer, token GitHub, API berbayar, sertifikat tambahan, atau unggahan hasil pengukuran.

## Pilihan akses

| Pilihan | Keputusan |
| --- | --- |
| `file://` / membuka ZIP langsung | Bisa untuk sebagian interaksi; tidak dipakai sebagai bukti PWA/offline. |
| GitHub Pages | Tidak diasumsikan tersedia gratis untuk repo privat; visibilitas tidak diubah. |
| Preview HTTPS terautentikasi | Belum tersedia untuk proyek ini. Kapabilitas Sites yang tersedia memperlakukan URL deployment sebagai produksi; tidak dibuat/dideploy tanpa izin. |
| Server lokal di HP | Dipilih untuk persiapan tanpa deployment. Browser memandang localhost/loopback sebagai konteks tepercaya; API gerak tetap bergantung browser, izin dan hardware. Instalasi PWA di Android tetap perlu diuji. |

Kode sekarang mendaftarkan service worker pada konteks aman HTTP localhost maupun HTTPS, menampilkan kesiapan cache di tab **Metode**, dan menyediakan ikon PNG 192/512 dari SVG asli. Server hanya mendengar pada **127.0.0.1**, menyajikan daftar aset aplikasi, tanpa endpoint upload atau akses folder repo. Riwayat tetap di localStorage Chrome, bukan di server Python.

## Persiapan satu kali di HP

1. Pasang [Termux dari F-Droid](https://f-droid.org/en/packages/com.termux/) sesuai [panduan resmi Termux](https://github.com/termux/termux-app#installation). Tidak perlu memasang F-Droid jika mengunduh APK Termux langsung. Jika sudah memakai Termux, jangan hapus data atau mengganti sumber instalasi sembarangan. Jalur ini memakai build F-Droid; build Google Play eksperimental belum diuji.
2. Dari run CI hijau PR terkait Issue #3, unduh artifact **medlab-zero-android-test** melalui GitHub yang sudah login. Simpan/ubah nama unduhannya menjadi `medlab-zero-android-test.zip` di folder Download. Artifact privat, berlaku 14 hari dan berisi aset aplikasi, launcher Python, panduan ini dan SOURCE_SHA.txt; tidak berisi pengukuran. Ini bukan aplikasi yang sudah dipublikasikan.
3. Di Termux, tempel blok pertama:

```sh
pkg install python -y
termux-setup-storage
```

Setujui akses penyimpanan bila diminta dan tunggu selesai. Lalu tempel blok kedua:

```sh
python -m zipfile -e "$HOME/storage/downloads/medlab-zero-android-test.zip" "$HOME/medlab-zero"
python "$HOME/medlab-zero/tools/serve.py"
```

Buka **http://127.0.0.1:8765/** di **Chrome pada HP yang sama**. Gunakan alamat dan port yang sama pada sesi berikutnya agar riwayat berada pada origin yang sama. Jangan gunakan alamat IP Wi-Fi/LAN. Biarkan Termux berjalan selama persiapan cache; Android dapat menghentikan proses latar belakang. Jika port sudah dipakai, hentikan sesi server lama dengan Ctrl+C, lalu jalankan lagi. Perintah kedua itu juga menjadi perintah mulai pada sesi berikutnya; tidak perlu memasang ulang.

Jika akses folder Download ditolak di Android, salin ZIP melalui file manager yang mendukung lokasi Termux (Storage Access Framework) ke home Termux, lalu gunakan `python -m zipfile -e "$HOME/medlab-zero-android-test.zip" "$HOME/medlab-zero"`. Bila paket belum bisa dibuka, laporkan pesan error saja; jangan kirim token atau hasil fisiologis. Pemasangan software dan izin Android adalah tindakan fisik pengguna, belum dilakukan oleh Executor.

## Kartu uji yang sudah ada

Gunakan [tiga langkah di M0_TEST_REPORT.md](M0_TEST_REPORT.md#future-android-test-card-issue-3). Jalankan di Chrome biasa, bukan incognito. Buka tab **Metode**: harus menunjukkan konteks aman dan **Cache aplikasi siap** sebelum menguji buka ulang tanpa jaringan. Ketersediaan API tidak membuktikan sensor menghasilkan sampel.

Untuk uji offline: setelah cache siap, aktifkan airplane mode dan buka ulang alamat yang sama. Hasil itu hanya membuktikan putus internet bila server Termux masih berjalan. Untuk membuktikan cache, setelah cache siap hentikan server dengan Ctrl+C, lalu buka ulang alamat yang sama; catat PASS/FAIL. Jika Chrome menawarkan pemasangan, uji ikon terpasang secara terpisah; shortcut bukan bukti WebAPK. Bila gagal, mulai server lagi; jangan menyimpulkan data atau instalasi sudah valid.

Laporkan hanya: tipe HP, versi Chrome, tiga langkah PASS/FAIL/UNSUPPORTED dan pesan error. **Jangan unggah file hasil JSON/CSV, angka pribadi atau raw sensor ke GitHub/Drive.** Issue #3 tetap terbuka sampai ada bukti fisik yang memenuhi penerimaan.

## Bukti dan batas

Tes Node adalah simulasi; tes Python memeriksa server HTTP loopback dan paket allowlist di Linux. `tools/browser-smoke.cjs` menjalankan Chromium dengan viewport mobile di CI: secure context, interaksi sintetis, storage, ekspor, kegagalan hapus/retry dan reload offline. Log CI pada SHA PR adalah bukti hasil, bukan keberadaan skrip. Sensor/permission Android, instalasi Termux, pemasangan PWA dan cache setelah proses/browser dimatikan tetap **UNVERIFIED** sampai pengguna menguji.

Sumber primer diperiksa 2026-10-14:
- [MDN: secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) dan [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
- [Termux: instalasi](https://github.com/termux/termux-app#installation) dan [paket/storage](https://github.com/termux/termux-tools/blob/master/doc/termux.1.md.in).
- [Chrome: manifest installability](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest). Ikon merupakan persiapan; keputusan pemasangan tetap milik browser.
- [Playwright: CI](https://playwright.dev/docs/ci).
