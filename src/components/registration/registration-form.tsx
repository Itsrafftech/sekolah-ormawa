"use client";

import {
  type ChangeEvent,
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
  Check,
  FileText,
  Link2,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";

import {
  REGISTRATION_DRAFT_SCHEMA_VERSION,
  type PortfolioInput,
  type RegistrationFormConfig,
  type RegistrationPayload,
  type UploadReference,
} from "@/features/registration/contracts";
import {
  countWords,
  validateRegistrationPayload,
  type FieldErrors,
} from "@/features/registration/validation";

const steps = [
  ["01", "Identitas"],
  ["02", "Pilihan Birdep"],
  ["03", "Dokumen"],
  ["04", "Esai & Portofolio"],
  ["05", "Review & Submit"],
] as const;

type DraftPayload = Pick<RegistrationPayload, "identity" | "choices" | "essays"> & {
  portfolio: PortfolioInput[];
};

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
    identity: {
      name: "",
      nim: "",
      cohortCode: config.cohortCode,
      entryYear: config.entryYear,
      className: "",
      studyProgramId: "",
      phone: "",
      email: "",
      gpa: 0,
      domicile: "",
    },
    choices: [
      { departmentId: "", motivation: "" },
      { departmentId: "", motivation: "" },
    ],
    uploads: { cv: null, photo: null, studentCard: null },
    essays: { organizationExperience: "", contribution: "", academicBalance: "" },
    portfolio: [],
    consent: { truthful: false, processing: false, version: config.consentVersion },
  };
}

function draftStorageKey(periodId: string): string {
  return `sekolah-ormawa:registration-draft:${periodId}`;
}

function fieldId(key: string): string {
  return `field-${key.replaceAll(".", "-")}`;
}

export function RegistrationForm({ config }: { config: RegistrationFormConfig }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [payload, setPayload] = useState<RegistrationPayload>(() => emptyPayload(config));
  const [portfolioUploads, setPortfolioUploads] = useState<UploadReference[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [draftStatus, setDraftStatus] = useState("Memeriksa draft lokal...");
  const [draftReady, setDraftReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const latestPayload = useRef(payload);

  const requiresPortfolio = useMemo(
    () => payload.choices.some((choice) =>
      config.departments.find((department) => department.id === choice.departmentId)
        ?.requiresPortfolio === true),
    [config.departments, payload.choices],
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
              portfolio: draft.data.portfolio.filter((item) => item.type === "EXTERNAL_LINK"),
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
        identity: current.identity,
        choices: current.choices,
        essays: current.essays,
        portfolio: current.portfolio.filter((item) => item.type === "EXTERNAL_LINK"),
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
    window.localStorage.removeItem(draftStorageKey(config.periodId));
    setPayload(emptyPayload(config));
    setPortfolioUploads([]);
    setFieldErrors({});
    setDraftStatus("Draft lokal dihapus");
    setStep(0);
  }

  function validateStep(targetStep: number): boolean {
    const errors: FieldErrors = {};
    if (targetStep === 0) {
      if (payload.identity.name.trim().length < 2) errors["identity.name"] = "Nama lengkap wajib diisi.";
      if (payload.identity.nim.trim().length < 3) errors["identity.nim"] = "NIM wajib diisi.";
      if (!payload.identity.className.trim()) errors["identity.className"] = "Kelas wajib diisi.";
      if (!payload.identity.studyProgramId) errors["identity.studyProgramId"] = "Pilih program studi.";
      if (payload.identity.phone.trim().length < 8) errors["identity.phone"] = "Nomor WhatsApp belum valid.";
      if (!/^\S+@\S+\.\S+$/u.test(payload.identity.email)) errors["identity.email"] = "Email aktif belum valid.";
      if (payload.identity.gpa < 0 || payload.identity.gpa > 4) errors["identity.gpa"] = "IPK harus 0,00-4,00.";
      if (!payload.identity.domicile.trim()) errors["identity.domicile"] = "Domisili wajib diisi.";
    }
    if (targetStep === 1) {
      payload.choices.forEach((choice, index) => {
        if (!choice.departmentId) errors[`choices.${index}.departmentId`] = "Pilih Birdep.";
        if (countWords(choice.motivation) < config.motivationMinWords) {
          errors[`choices.${index}.motivation`] = `Motivasi minimal ${config.motivationMinWords} kata.`;
        }
      });
      if (payload.choices[0].departmentId === payload.choices[1].departmentId) {
        errors["choices.1.departmentId"] = "Pilihan 2 harus berbeda dari Pilihan 1.";
      }
    }
    if (targetStep === 2) {
      if (!payload.uploads.cv) errors["uploads.cv"] = "CV PDF wajib diunggah.";
      if (!payload.uploads.photo) errors["uploads.photo"] = "Pas foto wajib diunggah.";
    }
    if (targetStep === 3) {
      Object.entries(payload.essays).forEach(([key, value]) => {
        const words = countWords(value);
        if (words < config.essayMinWords || words > config.essayMaxWords) {
          errors[`essays.${key}`] = `Esai harus ${config.essayMinWords}-${config.essayMaxWords} kata.`;
        }
      });
      if (requiresPortfolio && payload.portfolio.length === 0) {
        errors.portfolio = "Tambahkan minimal satu file karya atau tautan HTTPS.";
      }
    }
    if (targetStep === 4) {
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
      setStep((current) => Math.min(4, current + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
          <h1 id="registration-title">Lima langkah menuju satu keputusan yang matang.</h1>
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
              <li key={key}><a href={`#${fieldId(key)}`}>{message}</a></li>
            ))}
          </ul>
        </div>
      ) : null}

      <form className="registration-form" noValidate onSubmit={(event) => event.preventDefault()}>
        {step === 0 ? (
          <IdentityStep config={config} errors={fieldErrors} payload={payload} mutate={mutate} />
        ) : null}
        {step === 1 ? (
          <ChoiceStep config={config} errors={fieldErrors} payload={payload} mutate={mutate} />
        ) : null}
        {step === 2 ? (
          <DocumentStep config={config} errors={fieldErrors} payload={payload} mutate={mutate} />
        ) : null}
        {step === 3 ? (
          <EssayPortfolioStep
            config={config}
            errors={fieldErrors}
            payload={payload}
            portfolioUploads={portfolioUploads}
            requiresPortfolio={requiresPortfolio}
            mutate={mutate}
            setPortfolioUploads={setPortfolioUploads}
          />
        ) : null}
        {step === 4 ? (
          <ReviewStep config={config} errors={fieldErrors} payload={payload} requiresPortfolio={requiresPortfolio} mutate={mutate} />
        ) : null}
      </form>

      <footer className="form-actions">
        <button className="button button--outline" disabled={step === 0 || submitting} onClick={() => setStep((current) => current - 1)} type="button">
          <ArrowLeft aria-hidden="true" size={17} /> Sebelumnya
        </button>
        <span>Langkah {step + 1} dari {steps.length}</span>
        {step < 4 ? (
          <button className="button button--primary" onClick={nextStep} type="button">
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
  return (
    <div className={`form-field${error ? " has-error" : ""}`} id={fieldId(id)}>
      <label htmlFor={`${fieldId(id)}-control`}>{label}</label>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <p className="field-error">{error}</p> : null}
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
        <Field id="identity.studyProgramId" label="Program studi" error={errors["identity.studyProgramId"]} hint="Bersumber dari master data periode.">
          <select id={`${fieldId("identity.studyProgramId")}-control`} value={payload.identity.studyProgramId} onChange={(e) => update("studyProgramId", e.target.value)}>
            <option value="">Pilih program studi</option>
            {config.studyPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}{program.isDraft ? " (DRAFT)" : ""}</option>)}
          </select>
        </Field>
        <Field id="identity.phone" label="Nomor WhatsApp" error={errors["identity.phone"]} hint="Format lokal akan dinormalisasi menjadi +62 oleh server.">
          <input id={`${fieldId("identity.phone")}-control`} value={payload.identity.phone} onChange={(e) => update("phone", e.target.value)} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field id="identity.email" label="Email aktif" error={errors["identity.email"]}>
          <input id={`${fieldId("identity.email")}-control`} value={payload.identity.email} onChange={(e) => update("email", e.target.value)} type="email" autoComplete="email" />
        </Field>
        <Field id="identity.gpa" label="IPK terakhir" error={errors["identity.gpa"]} hint="Rentang 0,00-4,00.">
          <input id={`${fieldId("identity.gpa")}-control`} value={payload.identity.gpa || ""} onChange={(e) => update("gpa", Number(e.target.value))} type="number" min="0" max="4" step="0.01" inputMode="decimal" />
        </Field>
        <Field id="identity.domicile" label="Domisili" error={errors["identity.domicile"]}>
          <input id={`${fieldId("identity.domicile")}-control`} value={payload.identity.domicile} onChange={(e) => update("domicile", e.target.value)} autoComplete="address-level2" />
        </Field>
      </div>
    </StepFrame>
  );
}

function ChoiceStep({ config, errors, payload, mutate }: StepProps) {
  const updateChoice = (index: 0 | 1, key: "departmentId" | "motivation", value: string) =>
    mutate((current) => {
      const choices = [...current.choices] as RegistrationPayload["choices"];
      choices[index] = { ...choices[index], [key]: value };
      return { ...current, choices };
    });
  return (
    <StepFrame number="02" eyebrow="Tentukan ruang belajar" title="Dua pilihan Birdep">
      <div className="choice-stack">
        {([0, 1] as const).map((index) => (
          <article className="choice-panel" key={index}>
            <header><span>0{index + 1}</span><h3>Pilihan {index + 1}</h3>{index === 0 ? <small>Utama</small> : <small>Alternatif</small>}</header>
            <Field id={`choices.${index}.departmentId`} label={`Birdep pilihan ${index + 1}`} error={errors[`choices.${index}.departmentId`]}>
              <select id={`${fieldId(`choices.${index}.departmentId`)}-control`} value={payload.choices[index].departmentId} onChange={(e) => updateChoice(index, "departmentId", e.target.value)}>
                <option value="">Pilih Birdep aktif</option>
                {config.departments.filter((department) => department.id !== payload.choices[index === 0 ? 1 : 0].departmentId).map((department) => (
                  <option key={department.id} value={department.id}>{department.name}{department.requiresPortfolio ? " - portofolio wajib" : ""}</option>
                ))}
              </select>
            </Field>
            <Field id={`choices.${index}.motivation`} label={`Motivasi Pilihan ${index + 1}`} error={errors[`choices.${index}.motivation`]} hint={`Minimal ${config.motivationMinWords} kata · ${countWords(payload.choices[index].motivation)} kata`}>
              <textarea id={`${fieldId(`choices.${index}.motivation`)}-control`} value={payload.choices[index].motivation} onChange={(e) => updateChoice(index, "motivation", e.target.value)} rows={8} aria-describedby={`${fieldId(`choices.${index}.motivation`)}-counter`} />
            </Field>
          </article>
        ))}
      </div>
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
        <label className="upload-picker" htmlFor={`${fieldId(id)}-control`}><input accept={accept} aria-label={`Pilih file ${label}`} disabled={uploading} id={`${fieldId(id)}-control`} onChange={upload} type="file" /><span>{uploading ? "Memproses..." : "Pilih file"}</span></label>
      )}
      {uploading ? <progress aria-label={`Progres upload ${label}`} /> : null}
      {status ? <small aria-live="polite">{status}</small> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

function EssayPortfolioStep({ config, errors, payload, requiresPortfolio, portfolioUploads, mutate, setPortfolioUploads }: StepProps & {
  requiresPortfolio: boolean;
  portfolioUploads: UploadReference[];
  setPortfolioUploads: (value: UploadReference[]) => void;
}) {
  const updateEssay = (key: keyof RegistrationPayload["essays"], value: string) => mutate((current) => ({ ...current, essays: { ...current.essays, [key]: value } }));
  const essayFields = [
    ["organizationExperience", "Pengalaman organisasi sebelumnya"],
    ["contribution", "Kontribusi untuk Pilihan 1"],
    ["academicBalance", "Cara menyeimbangkan akademik dan organisasi"],
  ] as const;
  function addExternal() {
    mutate((current) => ({ ...current, portfolio: [...current.portfolio, { type: "EXTERNAL_LINK", externalUrl: "", title: "", description: "", applicantRole: "", sortOrder: current.portfolio.length }] }));
  }
  async function addPortfolioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const body = new FormData(); body.set("periodId", config.periodId); body.set("kind", "PORTFOLIO"); body.set("file", file);
    const response = await fetch("/api/registration/uploads", { method: "POST", body });
    const result = await response.json() as { upload?: UploadReference; error?: string };
    if (!response.ok || !result.upload) { window.alert(result.error ?? "Upload portofolio gagal."); return; }
    const upload = result.upload;
    setPortfolioUploads([...portfolioUploads, upload]);
    mutate((current) => ({ ...current, portfolio: [...current.portfolio, { type: "FILE", fileUploadId: upload.id, title: "", description: "", applicantRole: "", sortOrder: current.portfolio.length }] }));
    event.target.value = "";
  }
  function updatePortfolio(index: number, key: keyof PortfolioInput, value: string | number) {
    mutate((current) => ({ ...current, portfolio: current.portfolio.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  }
  async function removePortfolio(index: number) {
    const item = payload.portfolio[index];
    if (item.type === "FILE" && item.fileUploadId) {
      await fetch(`/api/registration/uploads/${item.fileUploadId}`, { method: "DELETE" });
      setPortfolioUploads(portfolioUploads.filter((upload) => upload.id !== item.fileUploadId));
    }
    mutate((current) => ({ ...current, portfolio: current.portfolio.filter((_, itemIndex) => itemIndex !== index).map((entry, itemIndex) => ({ ...entry, sortOrder: itemIndex })) }));
  }
  return (
    <StepFrame number="04" eyebrow="Cerita dan bukti karya" title="Esai & portofolio bersyarat">
      <div className="essay-stack">
        {essayFields.map(([key, label]) => <Field key={key} id={`essays.${key}`} label={label} error={errors[`essays.${key}`]} hint={`${config.essayMinWords}-${config.essayMaxWords} kata · ${countWords(payload.essays[key])} kata`}><textarea id={`${fieldId(`essays.${key}`)}-control`} value={payload.essays[key]} onChange={(event) => updateEssay(key, event.target.value)} rows={7} /></Field>)}
      </div>
      <section className={`portfolio-section${requiresPortfolio ? " is-required" : ""}`} id={fieldId("portfolio")}>
        <header><div><p className="eyebrow">Media Branding</p><h3>Portofolio karya</h3><p>{requiresPortfolio ? "Wajib karena Media Branding dipilih." : "Opsional untuk pilihan saat ini."}</p></div><span>{payload.portfolio.length} item</span></header>
        {errors.portfolio ? <p className="field-error">{errors.portfolio}</p> : null}
        <div className="portfolio-actions">
          <label className="button button--outline"><UploadCloud aria-hidden="true" size={16} /> Tambah file<input accept=".jpg,.jpeg,.png,image/jpeg,image/png" aria-label="Tambah file portofolio" disabled={portfolioUploads.length >= config.portfolioMaxFiles} onChange={addPortfolioFile} type="file" /></label>
          <button className="button button--outline" onClick={addExternal} type="button"><Link2 aria-hidden="true" size={16} /> Tambah tautan HTTPS</button>
        </div>
        <p className="portfolio-policy">Maksimum {config.portfolioMaxFiles} file, {formatBytes(config.portfolioMaxFileBytes)} per file. Server tidak mengambil isi tautan.</p>
        <div className="portfolio-list">
          {payload.portfolio.map((item, index) => {
            const upload = item.fileUploadId ? portfolioUploads.find((entry) => entry.id === item.fileUploadId) : null;
            return <article key={`${item.type}-${item.fileUploadId ?? index}`}><header><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.type === "FILE" ? upload?.name ?? "File privat" : "Tautan eksternal"}</strong><button aria-label={`Hapus item portofolio ${index + 1}`} onClick={() => removePortfolio(index)} type="button"><Trash2 aria-hidden="true" size={16} /></button></header>{item.type === "EXTERNAL_LINK" ? <Field id={`portfolio.${index}`} label="URL HTTPS" error={errors[`portfolio.${index}`]}><input id={`${fieldId(`portfolio.${index}`)}-control`} value={item.externalUrl ?? ""} onChange={(event) => updatePortfolio(index, "externalUrl", event.target.value)} type="url" placeholder="https://" /></Field> : null}<div className="form-grid form-grid--two"><Field id={`portfolio.${index}.title`} label="Judul karya"><input id={`${fieldId(`portfolio.${index}.title`)}-control`} value={item.title ?? ""} onChange={(event) => updatePortfolio(index, "title", event.target.value)} /></Field><Field id={`portfolio.${index}.applicantRole`} label="Peranmu"><input id={`${fieldId(`portfolio.${index}.applicantRole`)}-control`} value={item.applicantRole ?? ""} onChange={(event) => updatePortfolio(index, "applicantRole", event.target.value)} /></Field><Field id={`portfolio.${index}.description`} label="Deskripsi / kategori"><textarea id={`${fieldId(`portfolio.${index}.description`)}-control`} value={item.description ?? ""} onChange={(event) => updatePortfolio(index, "description", event.target.value)} rows={3} /></Field><Field id={`portfolio.${index}.creationYear`} label="Tahun pembuatan"><input id={`${fieldId(`portfolio.${index}.creationYear`)}-control`} value={item.creationYear ?? ""} onChange={(event) => updatePortfolio(index, "creationYear", Number(event.target.value))} type="number" min="1900" max="2200" /></Field></div></article>;
          })}
        </div>
      </section>
    </StepFrame>
  );
}

function ReviewStep({ config, errors, payload, requiresPortfolio, mutate }: StepProps & { requiresPortfolio: boolean }) {
  const department = (id: string) => config.departments.find((item) => item.id === id)?.name ?? "-";
  const program = config.studyPrograms.find((item) => item.id === payload.identity.studyProgramId)?.name ?? "-";
  const setConsent = (key: "truthful" | "processing", value: boolean) => mutate((current) => ({ ...current, consent: { ...current.consent, [key]: value } }));
  return (
    <StepFrame number="05" eyebrow="Periksa sebelum commit" title="Review & persetujuan">
      <div className="review-sheet">
        <ReviewSection title="Identitas"><dl><ReviewItem label="Nama" value={payload.identity.name} /><ReviewItem label="NIM" value={payload.identity.nim} /><ReviewItem label="Angkatan / tahun masuk" value={`${payload.identity.cohortCode} / ${payload.identity.entryYear}`} /><ReviewItem label="Prodi" value={program} /><ReviewItem label="Kelas" value={payload.identity.className} /><ReviewItem label="WhatsApp" value={payload.identity.phone} /><ReviewItem label="Email" value={payload.identity.email} /><ReviewItem label="IPK" value={payload.identity.gpa.toFixed(2)} /><ReviewItem label="Domisili" value={payload.identity.domicile} /></dl></ReviewSection>
        <ReviewSection title="Pilihan Birdep">{payload.choices.map((choice, index) => <article key={index}><strong>Pilihan {index + 1} · {department(choice.departmentId)}</strong><p>{choice.motivation}</p></article>)}</ReviewSection>
        <ReviewSection title="Dokumen"><ul><li>CV · {payload.uploads.cv ? `${payload.uploads.cv.name} (${formatBytes(payload.uploads.cv.sizeBytes)})` : "Belum ada"}</li><li>Pas foto · {payload.uploads.photo ? `${payload.uploads.photo.name} (${formatBytes(payload.uploads.photo.sizeBytes)})` : "Belum ada"}</li><li>KTM · {payload.uploads.studentCard ? `${payload.uploads.studentCard.name} (${formatBytes(payload.uploads.studentCard.sizeBytes)})` : "Tidak dilampirkan"}</li></ul></ReviewSection>
        <ReviewSection title="Esai"><article><strong>Pengalaman organisasi</strong><p>{payload.essays.organizationExperience}</p></article><article><strong>Kontribusi untuk Pilihan 1</strong><p>{payload.essays.contribution}</p></article><article><strong>Keseimbangan akademik</strong><p>{payload.essays.academicBalance}</p></article></ReviewSection>
        {requiresPortfolio || payload.portfolio.length > 0 ? <ReviewSection title="Portofolio"><ul>{payload.portfolio.map((item, index) => <li key={index}>{index + 1}. {item.type === "FILE" ? "File privat" : item.externalUrl} · {item.title || "Tanpa judul"}</li>)}</ul></ReviewSection> : null}
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
