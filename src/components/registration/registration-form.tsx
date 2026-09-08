"use client";

import {
  type ChangeEvent,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  FileText,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";

import {
  REGISTRATION_DRAFT_SCHEMA_VERSION,
  type AdkesmahFocus,
  type DepartmentsByTrack,
  type PublicDepartmentOption,
  type RegistrationFormConfig,
  type RegistrationPayload,
  type Track,
  type UploadReference,
} from "@/features/registration/contracts";
import {
  countWords,
  isValidGoogleDriveUrl,
  validateRegistrationPayload,
  type FieldErrors,
} from "@/features/registration/validation";

// "Guidebook, ketentuan, dan pembayaran": reordered per spec - Esai &
// Portofolio now comes BEFORE Bukti Follow dan Share (previously the
// other way around, from "persyaratan follow dan share"), and Pembayaran
// is a new step inserted before Review & Submit.
const steps = [
  ["00", "Guidebook & Jalur"],
  ["01", "Identitas"],
  ["02", "Pilihan Birdep"],
  ["03", "Dokumen"],
  ["04", "Esai & Portofolio"],
  ["05", "Bukti Follow dan Share"],
  ["06", "Pembayaran"],
  ["07", "Review & Submit"],
] as const;

// "Guidebook, ketentuan, dan pembayaran". Opens in a new tab per spec.
const GUIDEBOOK_URL = "https://drive.google.com/drive/folders/1HE9Adis3C5pRl2U4CHUQwhzQV2bZ9oDZ?usp=sharing";

// Gopay per spec - QRIS image not supplied yet (uploaded manually later to
// public/images/qris.png), see QrisPlaceholder below.
const GOPAY_NUMBER = "081273239606";
const GOPAY_NAME = "Farhanah Nurul Lathifah";

function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

const TRACK_LABEL: Record<Track, string> = {
  EXECUTIVE: "Eksekutif PKU",
  LEGISLATIVE: "Legislatif PKU",
};

// Phase C - "Field Khusus Per Birdep" (ADR-043).
const ADKESMAH_FOCUS_LABEL: Record<AdkesmahFocus, string> = {
  ADVOCACY: "Advokasi Mahasiswa",
  WELFARE: "Kesejahteraan Mahasiswa",
};

function allDepartments(departmentsByTrack: DepartmentsByTrack): PublicDepartmentOption[] {
  return [...departmentsByTrack.executive, ...departmentsByTrack.legislative];
}

function departmentsForTrack(departmentsByTrack: DepartmentsByTrack, track: Track | undefined): PublicDepartmentOption[] {
  if (track === "LEGISLATIVE") return departmentsByTrack.legislative;
  if (track === "EXECUTIVE") return departmentsByTrack.executive;
  return [];
}

// Same code-based special-casing submit.ts/config.ts use server-side
// (department.code === "MEDBRAND") - GET /api/departments's leaner shape
// (id/code/name/shortName only) doesn't carry a requiresPortfolio flag,
// so Step 2/4 derive it here instead of trusting a field that isn't sent.
// Phase C - "Field Khusus Per Birdep" (ADR-043): BADMEDBRND legislatif
// shares Medbrand eksekutif's exact same portfolio field.
function departmentRequiresPortfolio(department: PublicDepartmentOption | undefined): boolean {
  return department?.code === "MEDBRAND" || department?.code === "BADMEDBRND";
}

// Phase C - "Field Khusus Per Birdep" (ADR-043): same code-based
// special-casing as departmentRequiresPortfolio above.
function departmentRequiresMbti(department: PublicDepartmentOption | undefined): boolean {
  return department?.code === "KOMIT";
}

function departmentRequiresAdkesmahFocus(department: PublicDepartmentOption | undefined): boolean {
  return department?.code === "ADKESMAH";
}

function departmentAllowsBudgetPlan(department: PublicDepartmentOption | undefined): boolean {
  return department?.code === "KOMANGG";
}

// "Tambahan Field Khusus Ristek": optional portfolio link, same
// "allows"-not-"requires" naming as departmentAllowsBudgetPlan above
// (Komanggar's RAB) since neither is ever mandatory.
function departmentAllowsRistekPortfolio(department: PublicDepartmentOption | undefined): boolean {
  return department?.code === "RISTEK";
}

// Penugasan khusus Senbud ("Calon Rockidz"): informasional, bukan field
// submit - pendaftar SENBUD harus menyiapkan portofolio (opsional) dan
// video kreatif (wajib) di luar form. Ditampilkan di Step 2 (tag opsi),
// Step 4 (rincian), dan Step 7 (pengingat sebelum kirim).
function departmentHasSenbudPenugasan(department: PublicDepartmentOption | undefined): boolean {
  return department?.code === "SENBUD";
}

type DraftPayload = Pick<RegistrationPayload, "identity" | "choices" | "essays" | "track" | "guidebookAcknowledged" | "departmentFields">;

type SavedDraft = {
  periodId: string;
  schemaVersion: number;
  consentVersion: string;
  savedAt: string;
  expiresAt: string;
  data: DraftPayload;
};

function emptyPayload(config: RegistrationFormConfig): RegistrationPayload {
  return {
    periodId: config.periodId,
    track: undefined,
    guidebookAcknowledged: false,
    identity: {
      name: "",
      nim: "",
      cohortCode: config.cohortCode,
      entryYear: config.entryYear,
      className: "",
      studyProgram: "",
      phone: "",
      email: "",
      domicile: "",
    },
    choices: [
      { departmentId: "", motivation: "" },
      { departmentId: "", motivation: "" },
    ],
    uploads: { cv: null, photo: null, studentCard: null, followEvidence: null, paymentEvidence: null, senbudInstagramEvidence: null },
    essays: { organizationExperience: "", contribution: "", academicBalance: "" },
    // Phase C - "Field Khusus Per Birdep": empty object, not per-field
    // undefined literals - all keys stay optional/absent until the
    // relevant Birdep is chosen and the candidate fills them in.
    departmentFields: {},
    consent: { truthful: false, processing: false, version: config.consentVersion },
  };
}

function draftStorageKey(periodId: string): string {
  return `sekolah-ormawa:registration-draft:${periodId}`;
}

function fieldId(key: string): string {
  return `field-${key.replaceAll(".", "-")}`;
}

export function RegistrationForm({ config, departmentsByTrack }: { config: RegistrationFormConfig; departmentsByTrack: DepartmentsByTrack }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [payload, setPayload] = useState<RegistrationPayload>(() => emptyPayload(config));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [draftStatus, setDraftStatus] = useState("Memeriksa draft lokal...");
  const [draftReady, setDraftReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const latestPayload = useRef(payload);

  const selectedDepartments = useMemo(
    () => payload.choices.map((choice) =>
      allDepartments(departmentsByTrack).find((department) => department.id === choice.departmentId)),
    [departmentsByTrack, payload.choices],
  );
  const requiresPortfolio = useMemo(
    () => selectedDepartments.some((department) => departmentRequiresPortfolio(department)),
    [selectedDepartments],
  );
  // Phase C - "Field Khusus Per Birdep" (ADR-043).
  const requiresMbti = useMemo(
    () => selectedDepartments.some((department) => departmentRequiresMbti(department)),
    [selectedDepartments],
  );
  const requiresAdkesmahFocus = useMemo(
    () => selectedDepartments.some((department) => departmentRequiresAdkesmahFocus(department)),
    [selectedDepartments],
  );
  const allowsBudgetPlan = useMemo(
    () => selectedDepartments.some((department) => departmentAllowsBudgetPlan(department)),
    [selectedDepartments],
  );
  const requiresSenbudPenugasan = useMemo(
    () => selectedDepartments.some((department) => departmentHasSenbudPenugasan(department)),
    [selectedDepartments],
  );
  // "Tambahan Field Khusus Ristek".
  const allowsRistekPortfolio = useMemo(
    () => selectedDepartments.some((department) => departmentAllowsRistekPortfolio(department)),
    [selectedDepartments],
  );

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const key = draftStorageKey(config.periodId);
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          setDraftStatus("Belum ada draft lokal");
        } else {
          const draft = JSON.parse(raw) as SavedDraft;
          const valid =
            draft.periodId === config.periodId &&
            draft.schemaVersion === REGISTRATION_DRAFT_SCHEMA_VERSION &&
            new Date(draft.expiresAt).getTime() > Date.now();
          if (!valid) {
            window.localStorage.removeItem(key);
            setDraftStatus("Draft lama ditolak dengan aman");
          } else {
            setPayload((current) => ({
              ...current,
              ...draft.data,
              consent: {
                truthful: false,
                processing: false,
                version: config.consentVersion,
              },
            }));
            setDraftStatus(
              draft.consentVersion === config.consentVersion
                ? "Draft lokal dipulihkan"
                : "Draft dipulihkan; persetujuan wajib ditinjau ulang",
            );
          }
        }
      } catch {
        window.localStorage.removeItem(key);
        setDraftStatus("Draft rusak dihapus dengan aman");
      }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [config.consentVersion, config.periodId]);

  useEffect(() => {
    latestPayload.current = payload;
    if (!draftReady) return;
    const save = () => {
      const current = latestPayload.current;
      const data: DraftPayload = {
        track: current.track,
        guidebookAcknowledged: current.guidebookAcknowledged,
        identity: current.identity,
        choices: current.choices,
        essays: current.essays,
        // Phase C - "Field Khusus Per Birdep", extended Phase D (ADR-045)
        // with portfolioUrl/budgetPlanUrl: text values only ("Draft
        // localStorage menyimpan nilai text/radio, tidak menyimpan file")
        // - true of every departmentFields key, none of them ever
        // reference a file/upload.
        departmentFields: current.departmentFields,
      };
      const now = new Date();
      const draft: SavedDraft = {
        periodId: config.periodId,
        schemaVersion: REGISTRATION_DRAFT_SCHEMA_VERSION,
        consentVersion: config.consentVersion,
        savedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + config.draftTtlSeconds * 1000).toISOString(),
        data,
      };
      try {
        window.localStorage.setItem(draftStorageKey(config.periodId), JSON.stringify(draft));
        setDraftStatus(`Draft tersimpan ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        setDraftStatus("Draft lokal gagal disimpan");
      }
    };
    const debounce = window.setTimeout(save, 900);
    const maximum = window.setInterval(save, 30_000);
    return () => {
      window.clearTimeout(debounce);
      window.clearInterval(maximum);
    };
  }, [config.consentVersion, config.draftTtlSeconds, config.periodId, draftReady, payload]);

  function mutate(mutator: (current: RegistrationPayload) => RegistrationPayload) {
    setPayload((current) => mutator(current));
    setIdempotencyKey(null);
    setSubmitError(null);
  }

  function clearDraft() {
    // This wipes every step already filled in with no way to undo it, and
    // used to be one accidental click away (styled as a small inline text
    // link right at the top of the form) - gate it behind a confirmation
    // so it can't fire from a stray tap/click.
    const confirmed = window.confirm(
      "Hapus draft lokal? Semua data yang sudah diisi di formulir ini akan hilang dari perangkat ini dan tidak dapat dikembalikan.",
    );
    if (!confirmed) return;
    window.localStorage.removeItem(draftStorageKey(config.periodId));
    setPayload(emptyPayload(config));
    setFieldErrors({});
    setDraftStatus("Draft lokal dihapus");
    setStep(0);
  }

  function validateStep(targetStep: number): boolean {
    const errors: FieldErrors = {};
    if (targetStep === 0) {
      if (!payload.track) errors.track = "Pilih jalur pendaftaran.";
      // "Guidebook, ketentuan, dan pembayaran": required before the
      // registrant can leave Step 0 at all.
      if (!payload.guidebookAcknowledged) {
        errors.guidebookAcknowledged = "Kamu wajib mencentang bahwa sudah membaca guidebook dan ketentuan pendaftaran.";
      }
    }
    if (targetStep === 1) {
      if (payload.identity.name.trim().length < 2) errors["identity.name"] = "Nama lengkap wajib diisi.";
      if (payload.identity.nim.trim().length < 3) errors["identity.nim"] = "NIM wajib diisi.";
      if (!payload.identity.className.trim()) errors["identity.className"] = "Kelas wajib diisi.";
      if (payload.identity.studyProgram.trim().length < 3 || payload.identity.studyProgram.trim().length > 100) {
        errors["identity.studyProgram"] = "Program studi wajib diisi (3-100 karakter).";
      }
      if (payload.identity.phone.trim().length < 8) errors["identity.phone"] = "Nomor WhatsApp belum valid.";
      if (!/^\S+@\S+\.\S+$/u.test(payload.identity.email)) errors["identity.email"] = "Email aktif belum valid.";
      if (!payload.identity.domicile.trim()) errors["identity.domicile"] = "Domisili wajib diisi.";
    }
    if (targetStep === 2) {
      payload.choices.forEach((choice, index) => {
        if (!choice.departmentId) errors[`choices.${index}.departmentId`] = "Pilih Birdep.";
        if (countWords(choice.motivation) < config.motivationMinWords) {
          errors[`choices.${index}.motivation`] = `Motivasi minimal ${config.motivationMinWords} kata.`;
        }
      });
      if (payload.choices[0].departmentId === payload.choices[1].departmentId) {
        errors["choices.1.departmentId"] = "Pilihan 2 harus berbeda dari Pilihan 1.";
      }
      // Phase C - "Field Khusus Per Birdep" (ADR-043): required only when
      // the Birdep that needs it was actually chosen.
      if (requiresMbti && !payload.departmentFields.komitMbti) {
        errors["departmentFields.komitMbti"] = "Tipe MBTI wajib diisi karena Biro Kolaborasi dan Kemitraan dipilih.";
      }
      if (requiresAdkesmahFocus && !payload.departmentFields.adkesmahFocus) {
        errors["departmentFields.adkesmahFocus"] =
          "Bidang fokus wajib dipilih karena Departemen Advokasi dan Kesejahteraan Mahasiswa dipilih.";
      }
    }
    if (targetStep === 3) {
      if (!payload.uploads.cv) errors["uploads.cv"] = "CV PDF wajib diunggah.";
      if (!payload.uploads.photo) errors["uploads.photo"] = "Pas foto wajib diunggah.";
    }
    // "Guidebook, ketentuan, dan pembayaran": Esai & Portofolio (was Step
    // 5) moved to Step 4, now BEFORE Bukti Follow dan Share (was Step 4,
    // now Step 5) - reordered per spec.
    if (targetStep === 4) {
      Object.entries(payload.essays).forEach(([key, value]) => {
        const words = countWords(value);
        if (words < config.essayMinWords || words > config.essayMaxWords) {
          errors[`essays.${key}`] = `Esai harus ${config.essayMinWords}-${config.essayMaxWords} kata.`;
        }
      });
      // Phase D - "Portofolio via URL Google Drive" (ADR-045): required
      // only when Medbrand/Badmedbrnd is chosen, same dynamic pattern as
      // MBTI/fokus Adkesmah in Step 2.
      if (requiresPortfolio && !payload.departmentFields.portfolioUrl) {
        errors["departmentFields.portfolioUrl"] = "Link Google Drive portofolio wajib jika Media Branding dipilih.";
      } else if (
        payload.departmentFields.portfolioUrl &&
        !isValidGoogleDriveUrl(payload.departmentFields.portfolioUrl, config.portfolioUrlMaxLength)
      ) {
        errors["departmentFields.portfolioUrl"] = "Link harus berupa URL Google Drive yang valid (https://drive.google.com/...).";
      }
      // RAB Komanggar stays optional - only the format is checked.
      if (
        payload.departmentFields.budgetPlanUrl &&
        !isValidGoogleDriveUrl(payload.departmentFields.budgetPlanUrl, config.portfolioUrlMaxLength)
      ) {
        errors["departmentFields.budgetPlanUrl"] = "Link harus berupa URL Google Drive yang valid (https://drive.google.com/...).";
      }
      // "Tambahan Field Khusus Senbud": portfolio link tetap opsional
      // (hanya format dicek, sama seperti RAB Komanggar di atas); bukti
      // Instagram wajib hanya jika Senbud dipilih.
      if (
        payload.departmentFields.senbudPortfolioUrl &&
        !isValidGoogleDriveUrl(payload.departmentFields.senbudPortfolioUrl, config.portfolioUrlMaxLength)
      ) {
        errors["departmentFields.senbudPortfolioUrl"] = "Link harus berupa URL Google Drive yang valid (https://drive.google.com/...).";
      }
      if (requiresSenbudPenugasan && !payload.uploads.senbudInstagramEvidence) {
        errors["uploads.senbudInstagramEvidence"] = "Bukti upload story/post Instagram wajib diunggah karena Seni dan Budaya dipilih.";
      }
      // "Tambahan Field Khusus Ristek": tetap opsional, hanya format
      // dicek saat diisi - tidak ada requiredness check sama sekali.
      if (
        payload.departmentFields.ristekPortfolioUrl &&
        !isValidGoogleDriveUrl(payload.departmentFields.ristekPortfolioUrl, config.portfolioUrlMaxLength)
      ) {
        errors["departmentFields.ristekPortfolioUrl"] = "Link harus berupa URL Google Drive yang valid (https://drive.google.com/...).";
      }
    }
    if (targetStep === 5) {
      // UAT feedback - "persyaratan follow dan share": required for every
      // registrant regardless of track/department.
      if (!payload.uploads.followEvidence) {
        errors["uploads.followEvidence"] = "Bukti follow dan share (PDF) wajib diunggah.";
      }
    }
    // "Perubahan Sistem Pembayaran": nominal tetap untuk semua pendaftar,
    // tidak ada lagi kode unik untuk divalidasi.
    if (targetStep === 6) {
      if (!payload.uploads.paymentEvidence) {
        errors["uploads.paymentEvidence"] = "Bukti pembayaran wajib diunggah.";
      }
    }
    if (targetStep === 7) {
      if (!payload.consent.truthful) errors["consent.truthful"] = "Pernyataan kebenaran data wajib disetujui.";
      if (!payload.consent.processing) errors["consent.processing"] = "Persetujuan pemrosesan data wajib diberikan.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return false;
    }
    return true;
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep((current) => Math.min(7, current + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function chooseTrack(track: Track) {
    mutate((current) => {
      if (current.track === track) return current;
      // "Jika jalur diganti, reset pilihan Birdep di Step 2" - a
      // motivation written for an executive Birdep wouldn't make sense
      // carried over to a legislative one (or vice versa), so both
      // choices reset fully, not just the departmentId.
      return {
        ...current,
        track,
        choices: [
          { departmentId: "", motivation: "" },
          { departmentId: "", motivation: "" },
        ],
        // Phase C - "Field Khusus Per Birdep": a Birdep-specific value
        // (MBTI, fokus Adkesmah) no longer makes sense once the Birdep
        // choices that triggered it are wiped by a track change.
        departmentFields: {},
      };
    });
  }

  async function submit() {
    const validation = validateRegistrationPayload(payload, config);
    if (!validation.success) {
      setFieldErrors(validation.errors);
      setSubmitError("Masih ada data yang perlu diperbaiki.");
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    // Clear stale errors from a previous failed attempt (e.g. an earlier
    // validation failure) so a retry's error summary only ever reflects
    // this attempt's actual outcome - otherwise a transient network
    // failure here would surface alongside leftover messages from a
    // completely different, already-fixed problem.
    setFieldErrors({});
    const key = idempotencyKey ?? crypto.randomUUID().replaceAll("-", "");
    setIdempotencyKey(key);
    try {
      const response = await fetch("/api/registration/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as {
        error?: string;
        fieldErrors?: FieldErrors;
        confirmationToken?: string;
      };
      if (!response.ok || !result.confirmationToken) {
        setFieldErrors(result.fieldErrors ?? {});
        setSubmitError(result.error ?? "Submission gagal diproses.");
        window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
        return;
      }
      window.localStorage.removeItem(draftStorageKey(config.periodId));
      router.push(`/daftar/sukses?token=${encodeURIComponent(result.confirmationToken)}`);
    } catch {
      setSubmitError("Jaringan terputus. Coba lagi; kunci idempotensi yang sama akan digunakan.");
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="registration-workspace" aria-labelledby="registration-title">
      <header className="registration-intro">
        <div>
          <p className="eyebrow">Formulir pendaftaran / {config.periodName}</p>
          <h1 id="registration-title">Delapan langkah menuju satu keputusan yang matang.</h1>
        </div>
        <div className="draft-control" aria-live="polite">
          <Save aria-hidden="true" size={16} />
          <span>{draftStatus}</span>
          <button type="button" onClick={clearDraft}>Hapus draft</button>
        </div>
      </header>

      <nav className="form-progress" aria-label="Progres formulir">
        <ol>
          {steps.map(([number, label], index) => (
            <li className={index === step ? "is-current" : index < step ? "is-complete" : ""} key={number}>
              <button
                aria-current={index === step ? "step" : undefined}
                disabled={index > step}
                onClick={() => setStep(index)}
                type="button"
              >
                <span>{index < step ? <Check aria-hidden="true" size={15} /> : number}</span>
                <strong>{label}</strong>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {(Object.keys(fieldErrors).length > 0 || submitError) ? (
        <div className="error-summary" ref={errorSummaryRef} role="alert" tabIndex={-1}>
          <strong>Periksa kembali formulir.</strong>
          {submitError ? <p>{submitError}</p> : null}
          <ul>
            {Object.entries(fieldErrors).map(([key, message]) => (
              <li key={key}>
                <a
                  href={`#${fieldId(key)}`}
                  onClick={(event) => {
                    // A plain hash link only scrolls near the field - it
                    // doesn't move keyboard/screen-reader focus into the
                    // actual control, so the input itself still had to be
                    // found and clicked/tabbed to manually. Focus it
                    // directly instead (falling back to the field's own
                    // container, or its first focusable control, for
                    // fieldset-based fields like track/Adkesmah-fokus that
                    // have no single "-control" input).
                    event.preventDefault();
                    const control = document.getElementById(`${fieldId(key)}-control`);
                    const target = control ?? document.getElementById(fieldId(key));
                    if (!target) return;
                    target.scrollIntoView({ behavior: "smooth", block: "center" });
                    if (target instanceof HTMLElement && target.tabIndex >= 0) {
                      target.focus({ preventScroll: true });
                    } else {
                      target.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
                    }
                  }}
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form className="registration-form" noValidate onSubmit={(event) => event.preventDefault()}>
        {step === 0 ? (
          <TrackStep departmentsByTrack={departmentsByTrack} errors={fieldErrors} payload={payload} chooseTrack={chooseTrack} mutate={mutate} />
        ) : null}
        {step === 1 ? (
          <IdentityStep config={config} errors={fieldErrors} payload={payload} mutate={mutate} />
        ) : null}
        {step === 2 ? (
          <ChoiceStep
            departmentsByTrack={departmentsByTrack}
            config={config}
            errors={fieldErrors}
            payload={payload}
            mutate={mutate}
            requiresMbti={requiresMbti}
            requiresAdkesmahFocus={requiresAdkesmahFocus}
          />
        ) : null}
        {step === 3 ? (
          <DocumentStep config={config} errors={fieldErrors} payload={payload} mutate={mutate} />
        ) : null}
        {/* "Guidebook, ketentuan, dan pembayaran": Esai & Portofolio now
            renders at Step 4 (before Bukti Follow dan Share at Step 5) -
            reordered per spec, swapped from "persyaratan follow dan
            share"'s original 4/5 order. */}
        {step === 4 ? (
          <EssayPortfolioStep
            config={config}
            errors={fieldErrors}
            payload={payload}
            requiresPortfolio={requiresPortfolio}
            allowsBudgetPlan={allowsBudgetPlan}
            requiresSenbudPenugasan={requiresSenbudPenugasan}
            allowsRistekPortfolio={allowsRistekPortfolio}
            mutate={mutate}
          />
        ) : null}
        {step === 5 ? (
          <FollowEvidenceStep config={config} errors={fieldErrors} payload={payload} mutate={mutate} />
        ) : null}
        {step === 6 ? (
          <PaymentStep config={config} errors={fieldErrors} payload={payload} mutate={mutate} />
        ) : null}
        {step === 7 ? (
          <ReviewStep
            departmentsByTrack={departmentsByTrack}
            config={config}
            errors={fieldErrors}
            payload={payload}
            requiresPortfolio={requiresPortfolio}
            requiresMbti={requiresMbti}
            requiresAdkesmahFocus={requiresAdkesmahFocus}
            allowsBudgetPlan={allowsBudgetPlan}
            requiresSenbudPenugasan={requiresSenbudPenugasan}
            allowsRistekPortfolio={allowsRistekPortfolio}
            mutate={mutate}
          />
        ) : null}
      </form>

      <footer className="form-actions">
        <button className="button button--outline" disabled={step === 0 || submitting} onClick={() => setStep((current) => current - 1)} type="button">
          <ArrowLeft aria-hidden="true" size={17} /> Sebelumnya
        </button>
        <span>Langkah {step + 1} dari {steps.length}</span>
        {step < 7 ? (
          <button className="button button--primary" disabled={step === 0 && (!payload.track || !payload.guidebookAcknowledged)} onClick={nextStep} type="button">
            Simpan & lanjut <ArrowRight aria-hidden="true" size={17} />
          </button>
        ) : (
          <button className="button button--primary" disabled={submitting} onClick={submit} type="button">
            <ShieldCheck aria-hidden="true" size={17} /> {submitting ? "Mengirim..." : "Kirim pendaftaran"}
          </button>
        )}
      </footer>
    </section>
  );
}

type StepProps = {
  config: RegistrationFormConfig;
  errors: FieldErrors;
  payload: RegistrationPayload;
  mutate: (mutator: (current: RegistrationPayload) => RegistrationPayload) => void;
};

function TrackStep({ departmentsByTrack, errors, payload, chooseTrack, mutate }: {
  departmentsByTrack: DepartmentsByTrack;
  errors: FieldErrors;
  payload: RegistrationPayload;
  chooseTrack: (track: Track) => void;
  mutate: (mutator: (current: RegistrationPayload) => RegistrationPayload) => void;
}) {
  const options: Array<{ track: Track; description: string; count: number }> = [
    {
      track: "EXECUTIVE",
      description: "Birdep operasional: Biro dan Departemen di bawah koordinasi eksekutif.",
      count: departmentsByTrack.executive.length,
    },
    {
      track: "LEGISLATIVE",
      description: "Kombad: Komisi dan Badan di bawah koordinasi legislatif.",
      count: departmentsByTrack.legislative.length,
    },
  ];
  const setGuidebookAcknowledged = (value: boolean) =>
    mutate((current) => ({ ...current, guidebookAcknowledged: value }));
  return (
    <StepFrame number="00" eyebrow="Sebelum memilih Birdep" title="Pilih jalur pendaftaran">
      {/* "Guidebook, ketentuan, dan pembayaran": prominent banner + wajib
          checkbox, rendered before the Jalur picker per spec. */}
      <div className="guidebook-banner">
        <a href={GUIDEBOOK_URL} target="_blank" rel="noopener noreferrer" className="guidebook-banner__link">
          <BookOpen aria-hidden="true" size={20} /> Baca Guidebook & Ketentuan Pendaftaran
        </a>
        <label className={`guidebook-banner__checkbox${errors.guidebookAcknowledged ? " has-error" : ""}`} id={fieldId("guidebookAcknowledged")}>
          <input
            aria-describedby={errors.guidebookAcknowledged ? `${fieldId("guidebookAcknowledged")}-error` : undefined}
            aria-invalid={errors.guidebookAcknowledged ? true : undefined}
            checked={payload.guidebookAcknowledged ?? false}
            onChange={(event) => setGuidebookAcknowledged(event.target.checked)}
            type="checkbox"
          />
          <span>Saya sudah membaca guidebook dan ketentuan pendaftaran.</span>
        </label>
        {errors.guidebookAcknowledged ? (
          <p className="field-error" id={`${fieldId("guidebookAcknowledged")}-error`}>{errors.guidebookAcknowledged}</p>
        ) : null}
      </div>

      <fieldset className="track-picker" id={fieldId("track")}>
        <legend className="sr-only">Jalur pendaftaran</legend>
        <div className="track-picker__grid">
          {options.map(({ track, description, count }) => (
            <label className={`track-option${payload.track === track ? " is-selected" : ""}`} key={track}>
              <input
                checked={payload.track === track}
                name="track"
                onChange={() => chooseTrack(track)}
                type="radio"
                value={track}
              />
              <span className="track-option__title">{TRACK_LABEL[track]}</span>
              <span className="track-option__count">{count} unit tersedia</span>
              <span className="track-option__description">{description}</span>
            </label>
          ))}
        </div>
        {errors.track ? <p className="field-error">{errors.track}</p> : null}
      </fieldset>
    </StepFrame>
  );
}

function StepFrame({ number, eyebrow, title, children }: { number: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <fieldset className="form-step">
      <legend className="sr-only">{title}</legend>
      <div className="form-step__heading">
        <span aria-hidden="true">{number}</span>
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      </div>
      {children}
    </fieldset>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  // The input/select/textarea is passed in as `children` by every call
  // site rather than rendered here, so wiring aria-invalid/aria-describedby
  // onto it means cloning it with the extra props - a screen reader
  // reading the control previously got no indication an error (or hint)
  // existed until it happened to reach the sibling <p>/<small> in DOM
  // order.
  const describedBy = [hint ? `${fieldId(id)}-hint` : null, error ? `${fieldId(id)}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <div className={`form-field${error ? " has-error" : ""}`} id={fieldId(id)}>
      <label htmlFor={`${fieldId(id)}-control`}>{label}</label>
      {control}
      {hint ? <small id={`${fieldId(id)}-hint`}>{hint}</small> : null}
      {error ? <p className="field-error" id={`${fieldId(id)}-error`}>{error}</p> : null}
    </div>
  );
}

function IdentityStep({ config, errors, payload, mutate }: StepProps) {
  const update = (key: keyof RegistrationPayload["identity"], value: string | number) =>
    mutate((current) => ({ ...current, identity: { ...current.identity, [key]: value } }));
  return (
    <StepFrame number="01" eyebrow="Kenali data dasarmu" title="Identitas peserta">
      <div className="form-grid form-grid--two">
        <Field id="identity.name" label="Nama lengkap" error={errors["identity.name"]}>
          <input id={`${fieldId("identity.name")}-control`} value={payload.identity.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" />
        </Field>
        <Field id="identity.nim" label="NIM" error={errors["identity.nim"]} hint="Spasi dan tanda hubung dinormalisasi server.">
          <input id={`${fieldId("identity.nim")}-control`} value={payload.identity.nim} onChange={(e) => update("nim", e.target.value)} autoComplete="off" />
        </Field>
        <Field id="identity.cohortCode" label="Kode Angkatan IPB">
          <input id={`${fieldId("identity.cohortCode")}-control`} value={config.cohortCode} readOnly />
        </Field>
        <Field id="identity.entryYear" label="Tahun masuk">
          <input id={`${fieldId("identity.entryYear")}-control`} value={config.entryYear} readOnly />
        </Field>
        <Field id="identity.className" label="Kelas" error={errors["identity.className"]}>
          <input id={`${fieldId("identity.className")}-control`} value={payload.identity.className} onChange={(e) => update("className", e.target.value)} />
        </Field>
        <Field id="identity.studyProgram" label="Program Studi" error={errors["identity.studyProgram"]}>
          <input
            id={`${fieldId("identity.studyProgram")}-control`}
            value={payload.identity.studyProgram}
            onChange={(e) => update("studyProgram", e.target.value)}
            placeholder="Contoh: Teknologi Informasi, Manajemen, Agribisnis..."
            maxLength={100}
          />
        </Field>
        <Field id="identity.phone" label="Nomor WhatsApp" error={errors["identity.phone"]} hint="Format lokal akan dinormalisasi menjadi +62 oleh server.">
          <input id={`${fieldId("identity.phone")}-control`} value={payload.identity.phone} onChange={(e) => update("phone", e.target.value)} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field id="identity.email" label="Email aktif" error={errors["identity.email"]}>
          <input id={`${fieldId("identity.email")}-control`} value={payload.identity.email} onChange={(e) => update("email", e.target.value)} type="email" autoComplete="email" />
        </Field>
        <Field id="identity.domicile" label="Domisili" error={errors["identity.domicile"]}>
          <input id={`${fieldId("identity.domicile")}-control`} value={payload.identity.domicile} onChange={(e) => update("domicile", e.target.value)} autoComplete="address-level2" />
        </Field>
      </div>
    </StepFrame>
  );
}

function ChoiceStep({ config, departmentsByTrack, errors, payload, mutate, requiresMbti, requiresAdkesmahFocus }: StepProps & {
  departmentsByTrack: DepartmentsByTrack;
  requiresMbti: boolean;
  requiresAdkesmahFocus: boolean;
}) {
  const updateChoice = (index: 0 | 1, key: "departmentId" | "motivation", value: string) =>
    mutate((current) => {
      const choices = [...current.choices] as RegistrationPayload["choices"];
      choices[index] = { ...choices[index], [key]: value };
      return { ...current, choices };
    });
  const updateMbti = (value: string) =>
    mutate((current) => ({
      ...current,
      departmentFields: { ...current.departmentFields, komitMbti: value.toUpperCase() },
    }));
  const updateAdkesmahFocus = (value: AdkesmahFocus) =>
    mutate((current) => ({ ...current, departmentFields: { ...current.departmentFields, adkesmahFocus: value } }));
  // Phase B - "Jalur Legislatif": options come from GET /api/departments
  // (departmentsByTrack), filtered to the track chosen in Step 0 - not
  // config.departments, which is scoped to this period's
  // acceptsApplications and would leave a just-added track's Birdep
  // invisible here the moment it isn't currently accepting applications.
  const trackOptions = departmentsForTrack(departmentsByTrack, payload.track);
  return (
    <StepFrame number="02" eyebrow="Tentukan ruang belajar" title="Dua pilihan Birdep">
      <p className="track-context">
        Jalur dipilih: <strong>{payload.track ? TRACK_LABEL[payload.track] : "-"}</strong>
      </p>
      <div className="choice-stack">
        {([0, 1] as const).map((index) => (
          <article className="choice-panel" key={index}>
            <header><span>0{index + 1}</span><h3>Pilihan {index + 1}</h3>{index === 0 ? <small>Utama</small> : <small>Alternatif</small>}</header>
            <Field id={`choices.${index}.departmentId`} label={`Birdep pilihan ${index + 1}`} error={errors[`choices.${index}.departmentId`]}>
              <select id={`${fieldId(`choices.${index}.departmentId`)}-control`} value={payload.choices[index].departmentId} onChange={(e) => updateChoice(index, "departmentId", e.target.value)}>
                <option value="">Pilih Birdep aktif</option>
                {trackOptions.filter((department) => department.id !== payload.choices[index === 0 ? 1 : 0].departmentId).map((department) => (
                  <option key={department.id} value={department.id}>{department.name}{departmentRequiresPortfolio(department) ? " - portofolio wajib" : ""}{departmentHasSenbudPenugasan(department) ? " - wajib penugasan" : ""}</option>
                ))}
              </select>
            </Field>
            <Field id={`choices.${index}.motivation`} label={`Motivasi Pilihan ${index + 1}`} error={errors[`choices.${index}.motivation`]} hint={`Minimal ${config.motivationMinWords} kata · ${countWords(payload.choices[index].motivation)} kata`}>
              <textarea id={`${fieldId(`choices.${index}.motivation`)}-control`} value={payload.choices[index].motivation} onChange={(e) => updateChoice(index, "motivation", e.target.value)} rows={8} />
            </Field>
          </article>
        ))}
      </div>

      {/* Phase C - "Field Khusus Per Birdep" (ADR-043): dynamic, only
          rendered when the Birdep that needs it is one of the two
          choices above. */}
      {requiresMbti ? (
        <Field
          id="departmentFields.komitMbti"
          label="Tipe MBTI kamu"
          error={errors["departmentFields.komitMbti"]}
          hint="4 huruf, kombinasi I/E + N/S + T/F + J/P."
        >
          <input
            id={`${fieldId("departmentFields.komitMbti")}-control`}
            value={payload.departmentFields.komitMbti ?? ""}
            onChange={(e) => updateMbti(e.target.value)}
            placeholder="Contoh: INTJ, ENFP, ISTP..."
            maxLength={4}
            style={{ textTransform: "uppercase" }}
          />
        </Field>
      ) : null}
      {requiresAdkesmahFocus ? (
        <fieldset className="form-field" id={fieldId("departmentFields.adkesmahFocus")}>
          <legend>Bidang yang ingin kamu fokuskan</legend>
          <label>
            <input
              checked={payload.departmentFields.adkesmahFocus === "ADVOCACY"}
              name="adkesmah-focus"
              onChange={() => updateAdkesmahFocus("ADVOCACY")}
              type="radio"
              value="ADVOCACY"
            />
            <span>Advokasi Mahasiswa</span>
          </label>
          <label>
            <input
              checked={payload.departmentFields.adkesmahFocus === "WELFARE"}
              name="adkesmah-focus"
              onChange={() => updateAdkesmahFocus("WELFARE")}
              type="radio"
              value="WELFARE"
            />
            <span>Kesejahteraan Mahasiswa</span>
          </label>
          {errors["departmentFields.adkesmahFocus"] ? (
            <p className="field-error">{errors["departmentFields.adkesmahFocus"]}</p>
          ) : null}
        </fieldset>
      ) : null}
    </StepFrame>
  );
}

function DocumentStep({ config, errors, payload, mutate }: StepProps) {
  const setUpload = (key: keyof RegistrationPayload["uploads"], upload: UploadReference | null) =>
    mutate((current) => ({ ...current, uploads: { ...current.uploads, [key]: upload } }));
  return (
    <StepFrame number="03" eyebrow="Berkas privat" title="Dokumen pendaftaran">
      <div className="privacy-note"><ShieldCheck aria-hidden="true" size={24} /><div><strong>Disimpan di adapter private development.</strong><p>Tidak ada file di folder public dan object key tidak memuat nama, NIM, atau email.</p></div></div>
      <div className="upload-grid">
        <UploadField config={config} id="uploads.cv" label="CV" accept=".pdf,application/pdf" detail="Wajib · PDF · maksimum 2 MB" error={errors["uploads.cv"]} kind="CV" value={payload.uploads.cv} onChange={(value) => setUpload("cv", value)} />
        <UploadField config={config} id="uploads.photo" label="Pas foto" accept=".jpg,.jpeg,.png,image/jpeg,image/png" detail="Wajib · JPG/JPEG/PNG · maksimum 1 MB" error={errors["uploads.photo"]} kind="PHOTO" value={payload.uploads.photo} onChange={(value) => setUpload("photo", value)} />
        <UploadField config={config} id="uploads.studentCard" label="KTM / bukti mahasiswa aktif" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" detail="Opsional · JPG/JPEG/PNG/PDF · maksimum 1 MB" error={errors["uploads.studentCard"]} kind="STUDENT_CARD" value={payload.uploads.studentCard} onChange={(value) => setUpload("studentCard", value)} />
      </div>
    </StepFrame>
  );
}

function UploadField({ config, id, label, accept, detail, error, kind, value, onChange }: {
  config: RegistrationFormConfig; id: string; label: string; accept: string; detail: string; error?: string;
  kind: UploadReference["kind"]; value: UploadReference | null; onChange: (value: UploadReference | null) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setStatus("Mengunggah dan memvalidasi file...");
    const body = new FormData();
    body.set("periodId", config.periodId); body.set("kind", kind); body.set("file", file);
    try {
      const response = await fetch("/api/registration/uploads", { method: "POST", body });
      const result = await response.json() as { upload?: UploadReference; error?: string };
      if (!response.ok || !result.upload) throw new Error(result.error ?? "Upload gagal.");
      onChange(result.upload); setStatus("Upload privat tervalidasi.");
    } catch (uploadError) {
      setStatus(uploadError instanceof Error ? uploadError.message : "Upload gagal.");
    } finally { setUploading(false); event.target.value = ""; }
  }
  async function remove() {
    if (!value) return;
    await fetch(`/api/registration/uploads/${value.id}`, { method: "DELETE" });
    onChange(null); setStatus("Upload dihapus dari draft.");
  }
  return (
    <div className={`upload-field${error ? " has-error" : ""}`} id={fieldId(id)}>
      <div className="upload-field__icon" aria-hidden="true"><UploadCloud size={25} /></div>
      <div><strong>{label}</strong><p>{detail}</p></div>
      {value ? (
        <div className="upload-file"><FileText aria-hidden="true" size={18} /><span>{value.name}<small>{formatBytes(value.sizeBytes)}</small></span><button aria-label={`Hapus ${label}`} onClick={remove} type="button"><Trash2 aria-hidden="true" size={16} /></button></div>
      ) : (
        <label className="upload-picker" htmlFor={`${fieldId(id)}-control`}><input accept={accept} aria-describedby={error ? `${fieldId(id)}-error` : undefined} aria-invalid={error ? true : undefined} aria-label={`Pilih file ${label}`} disabled={uploading} id={`${fieldId(id)}-control`} onChange={upload} type="file" /><span>{uploading ? "Memproses..." : "Pilih file"}</span></label>
      )}
      {uploading ? <progress aria-label={`Progres upload ${label}`} /> : null}
      {status ? <small aria-live="polite">{status}</small> : null}
      {error ? <p className="field-error" id={`${fieldId(id)}-error`}>{error}</p> : null}
    </div>
  );
}

// UAT feedback - "persyaratan follow dan share". Applies to every
// registrant regardless of track/department, so unlike the Phase C/D
// department-triggered fields this step is never conditionally hidden -
// it always renders between Dokumen (Step 3) and Esai & Portofolio
// (Step 5).
function FollowEvidenceStep({ config, errors, payload, mutate }: StepProps) {
  const setUpload = (upload: UploadReference | null) =>
    mutate((current) => ({ ...current, uploads: { ...current.uploads, followEvidence: upload } }));
  return (
    <StepFrame number="05" eyebrow="Wajib untuk semua pendaftar" title="Bukti Follow dan Share">
      <div className="follow-evidence-instructions">
        <p>Sebelum mendaftar, pastikan kamu sudah:</p>
        <ol>
          <li>Follow @ormawaeksekutifpku dan seluruh akun Instagram Birdep Eksekutif PKU (11 akun — cari sendiri di Instagram)</li>
          <li>Follow @ormawalegislatifpku</li>
          <li>Share jarkoman Sekolah Ormawa ke 3 grup WhatsApp</li>
          <li>Share poster Sekolah Ormawa ke story Instagram pribadi kamu</li>
        </ol>
        <p>Kumpulkan semua screenshot bukti menjadi 1 file PDF dengan urutan:</p>
        <ol>
          <li>Screenshot follow @ormawaeksekutifpku</li>
          <li>Screenshot follow 11 akun Birdep Eksekutif (boleh beberapa screenshot)</li>
          <li>Screenshot follow @ormawalegislatifpku</li>
          <li>Screenshot share jarkoman ke 3 grup WhatsApp</li>
          <li>Screenshot story Instagram poster</li>
        </ol>
        <p>
          Format nama file PDF wajib:
          <br />
          <code>[Pilihan Birdep/Kombad 1]_[Nama Lengkap]_bukti follow dan share.pdf</code>
        </p>
        <p className="follow-evidence-instructions__example">
          Contoh: <code>PSDM_Muhammad Rafi Al Arifi_bukti follow dan share.pdf</code>
        </p>
      </div>
      <div className="upload-grid">
        <UploadField
          config={config}
          id="uploads.followEvidence"
          label="Bukti Follow dan Share (PDF)"
          accept=".pdf,application/pdf"
          detail="Wajib · PDF · maksimum 10 MB"
          error={errors["uploads.followEvidence"]}
          kind="FOLLOW_EVIDENCE"
          value={payload.uploads.followEvidence}
          onChange={setUpload}
        />
      </div>
    </StepFrame>
  );
}

function EssayPortfolioStep({ config, errors, payload, requiresPortfolio, allowsBudgetPlan, requiresSenbudPenugasan, allowsRistekPortfolio, mutate }: StepProps & {
  requiresPortfolio: boolean;
  allowsBudgetPlan: boolean;
  requiresSenbudPenugasan: boolean;
  allowsRistekPortfolio: boolean;
}) {
  const updateEssay = (key: keyof RegistrationPayload["essays"], value: string) => mutate((current) => ({ ...current, essays: { ...current.essays, [key]: value } }));
  const updateDriveUrl = (key: "portfolioUrl" | "budgetPlanUrl" | "senbudPortfolioUrl" | "ristekPortfolioUrl", value: string) =>
    mutate((current) => ({ ...current, departmentFields: { ...current.departmentFields, [key]: value } }));
  const setSenbudInstagramEvidence = (upload: UploadReference | null) =>
    mutate((current) => ({ ...current, uploads: { ...current.uploads, senbudInstagramEvidence: upload } }));
  const essayFields = [
    ["organizationExperience", "Pengalaman organisasi sebelumnya"],
    ["contribution", "Kontribusi untuk Pilihan 1"],
    ["academicBalance", "Cara menyeimbangkan akademik dan organisasi"],
  ] as const;
  return (
    <StepFrame number="04" eyebrow="Cerita dan bukti karya" title="Esai & portofolio bersyarat">
      <div className="essay-stack">
        {essayFields.map(([key, label]) => <Field key={key} id={`essays.${key}`} label={label} error={errors[`essays.${key}`]} hint={`${config.essayMinWords}-${config.essayMaxWords} kata · ${countWords(payload.essays[key])} kata`}><textarea id={`${fieldId(`essays.${key}`)}-control`} value={payload.essays[key]} onChange={(event) => updateEssay(key, event.target.value)} rows={7} /></Field>)}
      </div>

      {/* Phase D - "Portofolio via URL Google Drive" (ADR-045): dynamic,
          only rendered when Medbrand/Badmedbrnd is one of the two choices
          - replaces the old multi-item file/link portfolio mechanism
          entirely with a single Google Drive link. */}
      {requiresPortfolio ? (
        <section className="portfolio-section is-required" id={fieldId("departmentFields.portfolioUrl")}>
          <header><div><p className="eyebrow">Media Branding</p><h3>Portofolio karya</h3><p>Wajib karena Media Branding dipilih.</p></div></header>
          <Field
            id="departmentFields.portfolioUrl"
            label="Link Google Drive Portofolio"
            error={errors["departmentFields.portfolioUrl"]}
            hint="Pastikan link sudah diset 'Anyone with the link can view' sebelum dikirimkan."
          >
            <input
              id={`${fieldId("departmentFields.portfolioUrl")}-control`}
              value={payload.departmentFields.portfolioUrl ?? ""}
              onChange={(event) => updateDriveUrl("portfolioUrl", event.target.value)}
              type="url"
              placeholder="https://drive.google.com/..."
              maxLength={config.portfolioUrlMaxLength}
            />
          </Field>
        </section>
      ) : null}

      {/* Phase D - "Portofolio via URL Google Drive" (ADR-045): dynamic,
          only rendered when Komisi Anggaran is one of the two choices -
          always optional ("nilai plus"), unlike the portfolio field
          above. */}
      {allowsBudgetPlan ? (
        <section className="portfolio-section" id={fieldId("departmentFields.budgetPlanUrl")}>
          <header>
            <div><p className="eyebrow">Komisi Anggaran</p><h3>RAB (rencana anggaran biaya)</h3><p>Opsional, nilai plus untuk pilihan Komisi Anggaran.</p></div>
          </header>
          <Field
            id="departmentFields.budgetPlanUrl"
            label="Link Google Drive RAB"
            error={errors["departmentFields.budgetPlanUrl"]}
            hint="Pastikan link sudah diset 'Anyone with the link can view' sebelum dikirimkan."
          >
            <input
              id={`${fieldId("departmentFields.budgetPlanUrl")}-control`}
              value={payload.departmentFields.budgetPlanUrl ?? ""}
              onChange={(event) => updateDriveUrl("budgetPlanUrl", event.target.value)}
              type="url"
              placeholder="https://drive.google.com/..."
              maxLength={config.portfolioUrlMaxLength}
            />
          </Field>
        </section>
      ) : null}

      {/* "Tambahan Field Khusus Ristek": dynamic, only rendered when
          Ristek is one of the two choices - selalu opsional, sama pola
          dengan RAB Komanggar di atas (tidak pernah wajib, hanya format
          yang dicek saat diisi). */}
      {allowsRistekPortfolio ? (
        <section className="portfolio-section" id={fieldId("departmentFields.ristekPortfolioUrl")}>
          <header>
            <div><p className="eyebrow">Riset dan Teknologi</p><h3>Portofolio Ristek</h3><p>Opsional, nilai tambah untuk pilihan Riset dan Teknologi.</p></div>
          </header>
          <div className="follow-evidence-instructions">
            <p>
              Pengumpulan portofolio bersifat opsional, namun dapat menjadi nilai tambah dalam proses penilaian.
              Panduan lengkap portofolio dapat dilihat di{" "}
              <a href="https://ipb.link/portofolio-so-ristek" target="_blank" rel="noopener noreferrer">
                https://ipb.link/portofolio-so-ristek
              </a>
              .
            </p>
            <p>
              Pastikan akses Google Drive sudah dibuka untuk semua orang (Anyone with the link can view) sebelum
              memasukkan link di sini.
            </p>
          </div>
          <Field
            id="departmentFields.ristekPortfolioUrl"
            label="Link Portofolio (Opsional)"
            error={errors["departmentFields.ristekPortfolioUrl"]}
            hint="Pastikan link sudah diset 'Anyone with the link can view' sebelum dikirimkan."
          >
            <input
              id={`${fieldId("departmentFields.ristekPortfolioUrl")}-control`}
              value={payload.departmentFields.ristekPortfolioUrl ?? ""}
              onChange={(event) => updateDriveUrl("ristekPortfolioUrl", event.target.value)}
              type="url"
              placeholder="https://drive.google.com/..."
              maxLength={config.portfolioUrlMaxLength}
            />
          </Field>
        </section>
      ) : null}

      {/* "Perbaikan Tampilan Senbud": satu section gabungan (bukan dua
          section terpisah seperti sebelumnya) - field nyata Portofolio/
          Instagram ("Tambahan Field Khusus Senbud") diletakkan DI DALAM
          section "Penugasan khusus · Calon Rockidz" milik Tanss, sebelum
          Video Kreatif, sesuai urutan yang diminta. Sama seperti Medbrand/
          Komanggar di atas, field portofolio pakai kolom
          `senbudPortfolioUrl` sendiri (bukan `portfolioUrl`) karena
          Medbrand/Badmedbrnd dan Senbud sama-sama EXECUTIVE dan bisa
          dipilih bersamaan sebagai dua Pilihan yang berbeda. */}
      {requiresSenbudPenugasan ? (
        <section className="portfolio-section">
          <header>
            <div>
              <p className="eyebrow">Seni dan Budaya</p>
              <h3>Penugasan khusus · Calon Rockidz</h3>
              <p>Khusus pendaftar Senbud (Pilihan 1 atau 2). Persiapkan materi berikut sebelum pengumpulan.</p>
            </div>
          </header>
          <div className="follow-evidence-instructions">
            <p>Portofolio berisi:</p>
            <ol>
              <li>Biodata Diri</li>
              <li>Pengalaman Organisasi</li>
              <li>Bakat dan Minat (Opsional)</li>
            </ol>
            <p>
              Upload portofolio ke Google Drive kamu masing-masing dan pastikan akses dibuka untuk semua orang (Anyone
              with the link can view) sebelum memasukkan link di sini.
            </p>
          </div>
          <Field
            id="departmentFields.senbudPortfolioUrl"
            label="Link Portofolio (Opsional)"
            error={errors["departmentFields.senbudPortfolioUrl"]}
            hint="Pastikan link sudah diset 'Anyone with the link can view' sebelum dikirimkan."
          >
            <input
              id={`${fieldId("departmentFields.senbudPortfolioUrl")}-control`}
              value={payload.departmentFields.senbudPortfolioUrl ?? ""}
              onChange={(event) => updateDriveUrl("senbudPortfolioUrl", event.target.value)}
              type="url"
              placeholder="https://drive.google.com/..."
              maxLength={config.portfolioUrlMaxLength}
            />
          </Field>
          <div className="follow-evidence-instructions">
            <p>Unggah screenshot bukti upload Reels Instagram kamu.</p>
          </div>
          <div className="upload-grid">
            <UploadField
              config={config}
              id="uploads.senbudInstagramEvidence"
              label="Bukti Upload Reels Instagram"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              detail="Wajib · JPG/PNG · maksimum 5 MB"
              error={errors["uploads.senbudInstagramEvidence"]}
              kind="SENBUD_INSTAGRAM"
              value={payload.uploads.senbudInstagramEvidence}
              onChange={setSenbudInstagramEvidence}
            />
          </div>
          <ol className="penugasan-list">
            <li>
              <strong>Video Kreatif — Wajib, diunggah di Reels</strong>
              <p>Berisikan: (a) biodata diri; (b) alasan memilih Senbud; (c) program kerja yang diminati dan alasannya; (d) inovasi untuk program kerja tersebut.</p>
            </li>
          </ol>
          <div className="penugasan-notes">
            <strong>Catatan</strong>
            <ol>
              <li>Buat sekreatif mungkin, dengan konsep bebas.</li>
              <li>Portofolio disimpan di Google Drive dengan format nama <code>Nama Lengkap_NIM_Calon Rockidz</code>.</li>
              <li>Screenshot bukti unggah Video Kreatif di Reels juga masuk Google Drive dengan format nama <code>Nama Lengkap_NIM_usn ig_Calon Rockidz</code>.</li>
            </ol>
          </div>
        </section>
      ) : null}
    </StepFrame>
  );
}

// "Perubahan Sistem Pembayaran" (ADR-048): always renders (not conditional
// on track/department, same as FollowEvidenceStep) between Bukti Follow
// dan Share (Step 5) and Review & Submit (Step 7). Nominal tetap untuk
// semua pendaftar - tidak ada lagi kode unik yang perlu diambil dari
// server, jadi step ini tidak butuh efek/fetch sama sekali.
function PaymentStep({ config, errors, payload, mutate }: StepProps) {
  const [qrisFailed, setQrisFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const setEvidence = (upload: UploadReference | null) =>
    mutate((current) => ({ ...current, uploads: { ...current.uploads, paymentEvidence: upload } }));

  const copyGopayNumber = () => {
    navigator.clipboard.writeText(GOPAY_NUMBER).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };

  return (
    <StepFrame number="06" eyebrow="Wajib untuk semua pendaftar" title="Pembayaran">
      <div className="payment-info-box">
        <h3>Biaya Pendaftaran: {formatRupiah(config.paymentAmount)}</h3>
      </div>

      <div className="payment-methods">
        <article className="payment-method">
          <h3>Gopay</h3>
          <p className="payment-method__number">
            {GOPAY_NUMBER}
            <button type="button" className="payment-method__copy" onClick={copyGopayNumber} aria-label="Salin nomor Gopay">
              <Copy aria-hidden="true" size={14} /> {copied ? "Tersalin" : "Salin"}
            </button>
          </p>
          <p>a.n. {GOPAY_NAME}</p>
        </article>
        <article className="payment-method">
          <h3>QRIS</h3>
          {qrisFailed ? (
            <div className="payment-method__qris-placeholder">[QRIS akan tersedia]</div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static asset placeholder, uploaded manually later (see spec)
            <img src="/images/qris.png" alt="QRIS Sekolah Ormawa" onError={() => setQrisFailed(true)} />
          )}
        </article>
      </div>

      <div className="payment-instructions">
        <p>Cara pembayaran:</p>
        <ol>
          <li>Transfer via Gopay ke {GOPAY_NUMBER} (a.n. {GOPAY_NAME}) atau scan QRIS</li>
          <li>Nominal WAJIB tepat {formatRupiah(config.paymentAmount)}</li>
          <li>Screenshot bukti pembayaran</li>
          <li>Upload di bawah ini</li>
        </ol>
      </div>

      <div className="upload-grid">
        <UploadField
          config={config}
          id="uploads.paymentEvidence"
          label="Bukti Pembayaran"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          detail="Wajib · JPG/PNG/PDF · maksimum 5 MB"
          error={errors["uploads.paymentEvidence"]}
          kind="PAYMENT_EVIDENCE"
          value={payload.uploads.paymentEvidence}
          onChange={setEvidence}
        />
      </div>
    </StepFrame>
  );
}

function ReviewStep({ config, departmentsByTrack, errors, payload, requiresPortfolio, requiresMbti, requiresAdkesmahFocus, allowsBudgetPlan, requiresSenbudPenugasan, allowsRistekPortfolio, mutate }: StepProps & {
  departmentsByTrack: DepartmentsByTrack;
  requiresPortfolio: boolean;
  requiresMbti: boolean;
  requiresAdkesmahFocus: boolean;
  allowsBudgetPlan: boolean;
  requiresSenbudPenugasan: boolean;
  allowsRistekPortfolio: boolean;
}) {
  // departmentsByTrack first (matches what Step 2 actually showed/what the
  // user picked - correct regardless of this period's acceptsApplications
  // state), falling back to config.departments for robustness.
  const department = (id: string) =>
    allDepartments(departmentsByTrack).find((item) => item.id === id)?.name ??
    config.departments.find((item) => item.id === id)?.name ?? "-";
  const setConsent = (key: "truthful" | "processing", value: boolean) => mutate((current) => ({ ...current, consent: { ...current.consent, [key]: value } }));
  return (
    <StepFrame number="07" eyebrow="Periksa sebelum commit" title="Review & persetujuan">
      <div className="review-sheet">
        <ReviewSection title="Jalur Pendaftaran"><dl><ReviewItem label="Jalur" value={payload.track ? TRACK_LABEL[payload.track] : "-"} /><ReviewItem label="Guidebook & ketentuan" value={payload.guidebookAcknowledged ? "Sudah dibaca" : "-"} /></dl></ReviewSection>
        <ReviewSection title="Identitas"><dl><ReviewItem label="Nama" value={payload.identity.name} /><ReviewItem label="NIM" value={payload.identity.nim} /><ReviewItem label="Angkatan / tahun masuk" value={`${payload.identity.cohortCode} / ${payload.identity.entryYear}`} /><ReviewItem label="Prodi" value={payload.identity.studyProgram} /><ReviewItem label="Kelas" value={payload.identity.className} /><ReviewItem label="WhatsApp" value={payload.identity.phone} /><ReviewItem label="Email" value={payload.identity.email} /><ReviewItem label="Domisili" value={payload.identity.domicile} /></dl></ReviewSection>
        <ReviewSection title="Pilihan Birdep">{payload.choices.map((choice, index) => <article key={index}><strong>Pilihan {index + 1} · {department(choice.departmentId)}</strong><p>{choice.motivation}</p></article>)}</ReviewSection>
        {requiresMbti || requiresAdkesmahFocus || requiresPortfolio || allowsBudgetPlan || requiresSenbudPenugasan || allowsRistekPortfolio ? (
          <ReviewSection title="Data Khusus Birdep">
            <dl>
              {requiresMbti ? <ReviewItem label="Tipe MBTI" value={payload.departmentFields.komitMbti ?? ""} /> : null}
              {requiresAdkesmahFocus ? (
                <ReviewItem
                  label="Bidang fokus"
                  value={payload.departmentFields.adkesmahFocus ? ADKESMAH_FOCUS_LABEL[payload.departmentFields.adkesmahFocus] : ""}
                />
              ) : null}
              {requiresPortfolio ? <ReviewItem label="Link Portofolio" value={payload.departmentFields.portfolioUrl ?? ""} /> : null}
              {allowsBudgetPlan ? <ReviewItem label="Link RAB" value={payload.departmentFields.budgetPlanUrl ?? ""} /> : null}
              {/* "Tambahan Field Khusus Senbud". */}
              {requiresSenbudPenugasan ? <ReviewItem label="Link Portofolio Senbud" value={payload.departmentFields.senbudPortfolioUrl ?? ""} /> : null}
              {/* "Tambahan Field Khusus Ristek". */}
              {allowsRistekPortfolio ? <ReviewItem label="Link Portofolio Ristek" value={payload.departmentFields.ristekPortfolioUrl ?? ""} /> : null}
            </dl>
          </ReviewSection>
        ) : null}
        {requiresSenbudPenugasan ? (
          <ReviewSection title="Penugasan Senbud">
            {/* "Tambahan Field Khusus Senbud": status upload bukti Instagram
                ditampilkan di sini juga (section Senbud yang sama), bukan
                di card "Dokumen" generik di bawah - konsisten dengan
                pemisahan Pembayaran dari Dokumen. */}
            <ul><li>Bukti Upload Reels Instagram · {payload.uploads.senbudInstagramEvidence ? `${payload.uploads.senbudInstagramEvidence.name} (${formatBytes(payload.uploads.senbudInstagramEvidence.sizeBytes)})` : "Belum ada"}</li></ul>
            <div className="review-penugasan">
              <p><strong>Pastikan sebelum mengirim:</strong> Portofolio (opsional) dan Video Kreatif (wajib) untuk Senbud sudah disiapkan.</p>
              <ul>
                <li>Portofolio di Google Drive · format nama <code>Nama Lengkap_NIM_Calon Rockidz</code></li>
                <li>Screenshot bukti unggah Video Kreatif di Reels · format nama <code>Nama Lengkap_NIM_usn ig_Calon Rockidz</code></li>
              </ul>
            </div>
          </ReviewSection>
        ) : null}
        <ReviewSection title="Dokumen"><ul><li>CV · {payload.uploads.cv ? `${payload.uploads.cv.name} (${formatBytes(payload.uploads.cv.sizeBytes)})` : "Belum ada"}</li><li>Pas foto · {payload.uploads.photo ? `${payload.uploads.photo.name} (${formatBytes(payload.uploads.photo.sizeBytes)})` : "Belum ada"}</li><li>KTM · {payload.uploads.studentCard ? `${payload.uploads.studentCard.name} (${formatBytes(payload.uploads.studentCard.sizeBytes)})` : "Tidak dilampirkan"}</li><li>Bukti Follow dan Share · {payload.uploads.followEvidence ? `${payload.uploads.followEvidence.name} (${formatBytes(payload.uploads.followEvidence.sizeBytes)})` : "Belum ada"}</li></ul></ReviewSection>
        <ReviewSection title="Esai"><article><strong>Pengalaman organisasi</strong><p>{payload.essays.organizationExperience}</p></article><article><strong>Kontribusi untuk Pilihan 1</strong><p>{payload.essays.contribution}</p></article><article><strong>Keseimbangan akademik</strong><p>{payload.essays.academicBalance}</p></article></ReviewSection>
        {/* "Perubahan Sistem Pembayaran" (ADR-048): kode unik/total dihapus -
            nominal sama untuk semua pendaftar, sudah ditampilkan di Step
            Pembayaran itu sendiri, jadi tidak perlu diulang di ringkasan. */}
        <ReviewSection title="Pembayaran">
          <ul><li>Bukti pembayaran · {payload.uploads.paymentEvidence ? `${payload.uploads.paymentEvidence.name} (${formatBytes(payload.uploads.paymentEvidence.sizeBytes)})` : "Belum ada"}</li></ul>
        </ReviewSection>
      </div>
      <div className="consent-panel">
        <div className="consent-panel__version"><span>DRAFT DEVELOPMENT</span><strong>Versi consent: {config.consentVersion}</strong><p>Ini bukan kebijakan legal final dan submission production tetap fail-closed untuk consent DRAFT.</p></div>
        <label className={errors["consent.truthful"] ? "has-error" : ""} id={fieldId("consent.truthful")}><input checked={payload.consent.truthful} onChange={(event) => setConsent("truthful", event.target.checked)} type="checkbox" /><span>Saya menyatakan data yang diberikan benar dan dapat dipertanggungjawabkan.</span></label>
        <label className={errors["consent.processing"] ? "has-error" : ""} id={fieldId("consent.processing")}><input checked={payload.consent.processing} onChange={(event) => setConsent("processing", event.target.checked)} type="checkbox" /><span>Saya menyetujui pemrosesan data sesuai versi consent development yang ditampilkan.</span></label>
      </div>
    </StepFrame>
  );
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) { return <section className="review-section"><h3>{title}</h3>{children}</section>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value || "-"}</dd></div>; }
function formatBytes(value: number): string { return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`; }
