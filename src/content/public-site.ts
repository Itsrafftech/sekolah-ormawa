export const PUBLIC_CONTENT_STATUS = "DRAFT" as const;

export const publicSiteContent = {
  productName: "Sekolah Ormawa Eksekutif PKU",
  shortName: "Sekolah Ormawa",
  cohortLabel: "Mahasiswa baru IPB Angkatan 63",
  previewNotice:
    "Situs pratinjau. Jadwal, kontak, program kerja, dan kebijakan masih menunggu konfirmasi pengurus.",
  hero: {
    eyebrow: "Program magang dan pengenalan organisasi",
    title: "Belajar organisasi dari dalam, bertumbuh bersama.",
    description:
      "Sekolah Ormawa dirancang sebagai ruang bagi mahasiswa baru IPB Angkatan 63 untuk mengenal cara kerja organisasi, mencoba peran, dan belajar berkontribusi bersama Ormawa Eksekutif PKU.",
  },
  organization: {
    eyebrow: "Tentang organisasi",
    title: "Ruang kerja kolektif mahasiswa",
    description:
      "Ormawa Eksekutif PKU diperkenalkan di situs ini sebagai ekosistem organisasi mahasiswa dengan unit kerja yang beragam. Uraian profil resmi organisasi masih menunggu verifikasi pengurus.",
    note: "Copy profil organisasi berstatus DRAFT dan harus diganti dengan narasi resmi.",
  },
  program: {
    definition:
      "Program pengenalan dan pembelajaran organisasi melalui pengalaman terarah di unit kerja yang dipilih peserta.",
    duration:
      "Durasi dan beban kegiatan belum diumumkan. Informasi final akan mengikuti jadwal resmi periode aktif.",
    goals: [
      "Membantu peserta memahami ritme dan etika kerja organisasi.",
      "Memberi ruang eksplorasi minat sebelum mengambil peran yang lebih jauh.",
      "Mendorong kebiasaan kolaborasi, refleksi, dan tanggung jawab.",
    ],
    benefits: [
      "Pendampingan dan konteks kerja dari unit pilihan.",
      "Pengalaman berkolaborasi dalam lingkungan organisasi mahasiswa.",
      "Ruang refleksi untuk mengenali kekuatan dan arah pengembangan diri.",
    ],
    rights: [
      "Mendapat penjelasan kegiatan dan ekspektasi yang jelas.",
      "Mendapat ruang belajar yang aman dan umpan balik yang layak.",
      "Mendapat akses informasi sesuai kebutuhan program.",
    ],
    responsibilities: [
      "Menjaga komitmen dan komunikasi selama kegiatan.",
      "Menghormati sesama peserta, pendamping, dan aturan organisasi.",
      "Menjaga kerahasiaan informasi internal yang diterima.",
    ],
  },
  experiences: [
    {
      number: "01",
      title: "Mengenali ritme kerja",
      description:
        "Mengamati bagaimana sebuah unit menyusun prioritas, berkomunikasi, dan merawat tanggung jawab bersama.",
    },
    {
      number: "02",
      title: "Mencoba kontribusi",
      description:
        "Mengambil bagian dalam aktivitas pembelajaran yang disiapkan unit, sesuai kapasitas peserta dan kebutuhan periode.",
    },
    {
      number: "03",
      title: "Membaca ulang proses",
      description:
        "Mendokumentasikan pembelajaran dan menerima umpan balik sebagai bekal langkah organisasi berikutnya.",
    },
  ],
  gallery: [
    {
      label: "Ruang kolaborasi",
      caption: "Placeholder dokumentasi kegiatan - aset resmi belum tersedia.",
      variant: "arch",
    },
    {
      label: "Proses belajar",
      caption: "Placeholder dokumentasi pendampingan - aset resmi belum tersedia.",
      variant: "orbit",
    },
    {
      label: "Refleksi bersama",
      caption: "Placeholder dokumentasi penutupan - aset resmi belum tersedia.",
      variant: "steps",
    },
  ],
  testimonials: [
    "Cerita pengalaman peserta akan ditampilkan setelah narasumber dan kutipan diverifikasi.",
    "Perspektif pendamping unit akan ditambahkan setelah mendapatkan persetujuan publikasi.",
    "Kesan alumni program belum tersedia dan tidak digantikan dengan testimoni rekaan.",
  ],
  selectionTimeline: [
    {
      step: "Pendaftaran",
      detail: "Form dan jadwal menunggu periode resmi dibuka.",
    },
    {
      step: "Seleksi awal",
      detail: "Mekanisme dan kriterianya masih dalam konfigurasi DRAFT.",
    },
    {
      step: "Informasi hasil",
      detail: "Kanal serta tanggal pengumuman belum dikonfirmasi.",
    },
  ],
  internshipTimeline: [
    {
      step: "Orientasi",
      detail: "Pengenalan konteks, ekspektasi, dan cara kerja unit.",
    },
    {
      step: "Pengalaman di unit",
      detail: "Aktivitas pembelajaran menyesuaikan rancangan unit dan periode.",
    },
    {
      step: "Refleksi",
      detail: "Penutupan proses dan rangkuman pembelajaran peserta.",
    },
  ],
  faq: [
    {
      question: "Siapa yang dapat mengikuti Sekolah Ormawa?",
      answer:
        "Sasaran sementara program adalah mahasiswa baru IPB Angkatan 63. Aturan eligibility final masih menunggu konfirmasi pengurus dan akan diumumkan sebelum pendaftaran dibuka.",
    },
    {
      question: "Apakah pendaftaran sudah dibuka?",
      answer:
        "Status pada tombol pendaftaran dibaca langsung dari periode di server. Jika periode masih DRAFT atau CLOSED, situs tidak akan mengarahkan pengunjung ke form aktif.",
    },
    {
      question: "Apakah semua unit membuka slot?",
      answer:
        "Tidak selalu. Direktori menampilkan profil semua unit, sedangkan label pada setiap kartu menunjukkan apakah unit tersebut membuka slot pada periode aktif.",
    },
    {
      question: "Apakah pilihan Media Branding memerlukan portofolio?",
      answer:
        "Ya. Jika Biro Media Branding dipilih sebagai Pilihan 1 atau Pilihan 2, pendaftar wajib memberikan sedikitnya satu file JPG/JPEG/PNG yang valid atau satu tautan portofolio yang valid. Form dan validasi lengkap baru dibangun pada Phase 3.",
    },
    {
      question: "Berapa lama program berlangsung?",
      answer:
        "Durasi belum final. Timeline pelaksanaan di halaman ini adalah kerangka DRAFT tanpa tanggal resmi.",
    },
    {
      question: "Di mana kebijakan data peserta dapat dibaca?",
      answer:
        "Halaman kebijakan privasi sudah tersedia sebagai struktur awal. Isi hukum, consent, dan retensi belum final dan ditandai dengan jelas.",
    },
  ],
  footer: {
    contact: "Kontak resmi menunggu konfirmasi",
    social: "Akun media sosial resmi menunggu konfirmasi",
    organization: "Ormawa Eksekutif PKU",
  },
} as const;

export type PublicSiteContent = typeof publicSiteContent;
