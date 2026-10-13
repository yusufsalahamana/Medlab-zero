# Uji Android — akses publik lewat Chrome

**[Buka MED-LAB ZERO](https://yusufsalahamana.github.io/Medlab-zero/)** di Chrome pada HP Android. Tidak perlu Termux, ZIP, Python, laptop atau akun. Repo publik dan Pages aktif; Issue #3 selesai untuk distribusi saja.

## Kartu uji opsional pada perangkat nyata

1. **Motorik:** lakukan Reaction Time dan Finger Tapping, buka Riwayat, lalu muat ulang. Coba Motion Lab; catat apakah izin dan sampel sensor tersedia. Jangan melakukan gerakan yang dipaksakan.
2. **Kamera (setelah M1 terdeploy):** buka Camera Pulse Lab, izinkan kamera belakang, tutupi lensa dengan ujung jari secara lembut tanpa tekanan kuat selama 25 detik. Lampu hanya digunakan bila API mendukung. Batalkan bila panas/tidak nyaman. Coba menolak izin dan menutup eksperimen; indikator kamera harus padam. Sinyal buruk harus menghasilkan “Data tidak mencukupi”. Kandidat angka bukan bukti akurasi fisiologis.
3. **Offline/instalasi:** tab Metode harus menunjukkan **Cache aplikasi siap**. Aktifkan mode pesawat lalu buka ulang URL; catat apakah aplikasi terbuka. Jika Chrome menawarkan instalasi, coba membuka ikon yang terpasang secara terpisah; shortcut bukan bukti WebAPK.

Laporkan hanya tipe HP, versi Chrome, PASS/FAIL/UNSUPPORTED per langkah dan pesan error. **Jangan kirim angka fisiologis, foto, frame, gelombang atau ekspor riwayat ke GitHub/Drive.** Tidak ada langkah ini yang diklaim sudah dijalankan oleh Executor.

## Apa yang dibuktikan otomatis

- Node: perhitungan dan lifecycle dengan data sintetis, bukan sensor manusia.
- Python: server HTTP loopback dan paket allowlist Linux.
- Chromium localhost: DOM, video dari canvas sintetis, storage, ekspor, pembatalan/izin ditolak, cache offline.
- Chromium Pages: root HTTPS dan aset yang terdeploy, navigasi dan reload offline browser CI. Ini menguji main publik pada saat job berjalan; tidak menguji branch PR yang belum dipublikasikan.

Kamera/lampu Android, timing sensor nyata, instalasi PWA, offline setelah browser/proses dihentikan, serta akurasi terhadap referensi independen masih **UNVERIFIED**. Tidak perlu menghambat pengerjaan kode karena belum tersedia pengujian fisik.

Pengembang dapat memakai `python3 tools/serve.py` dan `tools/package_android.py` untuk loopback/paket sintetis. Jalur lokal tersebut bukan syarat akses pengguna dan bukan bukti pengujian Android.
