export const publicSiteContent = {
  productName: "Sekolah Ormawa PKU",
  shortName: "Sekolah Ormawa",
  cohortLabel: "Mahasiswa baru IPB Angkatan 63",
  hero: {
    eyebrow: "Program magang dan pengenalan organisasi",
    title: "Kenali organisasi. Temukan peran. Bertumbuh bersama.",
    description:
      "Sekolah Ormawa 2026 hadir sebagai ruang bagi mahasiswa IPB Angkatan 63 untuk mengenal lingkungan organisasi PKU, mempelajari cara kerjanya, dan mendapatkan pengalaman melalui program magang.",
  },
  organization: {
    eyebrow: "Tentang organisasi",
    title: "Ruang kerja kolektif mahasiswa",
    description:
      "Ruang belajar untuk mengenal ekosistem organisasi mahasiswa PKU. Peserta mengenal berbagai unit kerja serta memahami struktur dan peran organisasi secara langsung.",
    note: "Kenali setiap unit, pahami perannya, lalu temukan ruang untuk berkembang dan berkontribusi.",
  },
  program: {
    definition:
      "Sekolah Ormawa 2026 adalah program pengenalan dan pembelajaran organisasi melalui pengalaman langsung di unit kerja yang dipilih peserta.",
    duration:
      "20 September – 1 November 2026. Rangkaian Sekolah Ormawa 2026 berlangsung dari Opening Ceremony hingga Closing Ceremony.",
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
  // Exact dates from the Sekolah Ormawa 2026 guidebook linimasa - split
  // across the two existing TimelineColumn slots (registration/selection
  // vs. class sessions/closing) rather than the old three-generic-step
  // "belum dikonfirmasi" placeholders. Ten stages total, none invented.
  selectionTimeline: [
    {
      step: "Open Recruitment",
      detail: "8–18 September 2026",
    },
    {
      step: "Opening Ceremony",
      detail: "20 September 2026",
    },
    {
      step: "Pengumuman Seleksi Berkas",
      detail: "21 September 2026",
    },
    {
      step: "Seleksi Wawancara",
      detail: "22–24 September 2026",
    },
    {
      step: "Pengumuman Seleksi Wawancara",
      detail: "25 September 2026",
    },
  ],
  internshipTimeline: [
    {
      step: "First Class",
      detail: "26 September 2026",
    },
    {
      step: "Second Class",
      detail: "27 September 2026",
    },
    {
      step: "Third Class",
      detail: "3 Oktober 2026",
    },
    {
      step: "Fourth Class",
      detail: "31 Oktober 2026",
    },
    {
      step: "Closing Ceremony",
      detail: "1 November 2026",
    },
  ],
  faq: [
    {
      question: "Siapa yang dapat mengikuti Sekolah Ormawa?",
      answer:
        "Sekolah Ormawa 2026 ditujukan bagi mahasiswa aktif IPB Angkatan 63 yang ingin mengenal lingkungan organisasi PKU dan mempersiapkan diri mengambil peran di dalamnya.",
    },
    {
      question: "Apakah pendaftaran sudah dibuka?",
      answer:
        "Status pada tombol pendaftaran mengikuti periode yang berlaku. Jika periode belum resmi dibuka atau sudah ditutup, situs tidak akan mengarahkan pengunjung ke form aktif.",
    },
    {
      question: "Apakah semua unit membuka slot?",
      answer:
        "Tidak selalu. Direktori menampilkan profil semua unit, sedangkan label pada setiap kartu menunjukkan apakah unit tersebut membuka slot pada periode aktif.",
    },
    {
      question: "Apakah pilihan Media Branding memerlukan portofolio?",
      answer:
        "Ya. Jika Biro Media Branding dipilih sebagai Pilihan 1 atau Pilihan 2, pendaftar wajib memberikan sedikitnya satu file JPG/JPEG/PNG yang valid atau satu tautan portofolio yang valid.",
    },
    {
      question: "Berapa lama program berlangsung?",
      answer:
        "Rangkaian kegiatan berlangsung dari Open Recruitment hingga Closing Ceremony sesuai linimasa Sekolah Ormawa 2026 pada bagian Alur Program.",
    },
    {
      question: "Di mana kebijakan data peserta dapat dibaca?",
      answer:
        "Halaman kebijakan privasi sudah tersedia sebagai struktur awal. Isi hukum, consent, dan retensi belum final dan ditandai dengan jelas.",
    },
  ],
  footer: {
    organization: "Sekolah Ormawa · Ormawa PKU",
    credit: "Program kerja Departemen PSDM, Ormawa Eksekutif PKU.",
  },
  contact: {
    whatsappGroupLabel: "Gabung grup WhatsApp peserta",
    whatsappGroupUrl: "https://chat.whatsapp.com/JYfi6GQcRyAJmvb7kUDqBu",
  },
} as const;

export type PublicSiteContent = typeof publicSiteContent;
