import type { Doctor, Specialty, SpecialtyId } from "./types";

/** Filter chips read left-to-right in this order; "All" is rendered separately. */
export const SPECIALTIES: Specialty[] = [
  {
    id: "general",
    label: "General",
    clinical: "General Medicine",
    keywords: ["general", "fever", "cold", "flu", "physician", "checkup", "tired", "body ache"],
  },
  {
    id: "skin",
    label: "Skin",
    clinical: "Dermatology",
    keywords: ["skin", "rash", "acne", "hair", "dermatologist", "itch", "eczema", "fungal"],
  },
  {
    id: "heart",
    label: "Heart",
    clinical: "Cardiology",
    keywords: ["heart", "chest", "bp", "blood pressure", "palpitation", "cardio", "cholesterol"],
  },
  {
    id: "child",
    label: "Child",
    clinical: "Paediatrics",
    keywords: ["child", "kid", "baby", "infant", "paediatric", "vaccination", "infant feeding"],
  },
  {
    id: "dental",
    label: "Dental",
    clinical: "Dentistry",
    keywords: ["dental", "tooth", "teeth", "gum", "dentist", "cavity", "jaw"],
  },
  {
    id: "womens-health",
    label: "Women",
    clinical: "Obstetrics & Gynaecology",
    keywords: ["women", "period", "pregnancy", "postnatal", "gynae", "pcod", "breastfeeding"],
  },
  {
    id: "mental-health",
    label: "Mind",
    clinical: "Psychiatry & Counselling",
    keywords: ["mind", "anxiety", "stress", "sleep", "depression", "counselling", "panic", "burnout"],
  },
];

export const SPECIALTY_BY_ID: Record<SpecialtyId, Specialty> = SPECIALTIES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<SpecialtyId, Specialty>,
);

export const specialtyLabel = (id: SpecialtyId) => SPECIALTY_BY_ID[id]?.label ?? id;
export const specialtyClinical = (id: SpecialtyId) => SPECIALTY_BY_ID[id]?.clinical ?? id;

/**
 * The v1 catalogue.
 *
 * `verified: false` records stay in the database so the admin flow can show
 * them, but `listDoctors()` filters them out — the PRD requires manual
 * verification before a doctor is discoverable.
 */
export const DOCTORS: Doctor[] = [
  {
    id: "doc-asha-menon",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-48219",
      verifiedAt: "2026-01-14T09:12:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Asha Menon",
    specialty: "skin",
    qualifications: "MBBS, MD (Dermatology)",
    yearsExperience: 12,
    bio:
      "Treats acne, pigmentation and hair loss with a conservative, evidence-first approach. " +
      "Sends a photo-review follow-up two weeks after every course of treatment.",
    languages: ["English", "Tamil", "Hindi"],
    consultationFee: 450,
    currency: "INR",
    rating: 4.9,
    ratingCount: 218,
    accent: "teal",
    email: "asha.menon@carenow.health",
  },
  {
    id: "doc-ravi-iyer",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-31190",
      verifiedAt: "2026-01-09T11:40:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Ravi Iyer",
    specialty: "general",
    qualifications: "MBBS, DNB (Family Medicine)",
    yearsExperience: 9,
    bio:
      "Family physician for everyday illness — fevers, infections, travel advice and long-term " +
      "blood-pressure reviews. Keeps prescriptions short and explains every drug he sends.",
    languages: ["English", "Tamil", "Malayalam"],
    consultationFee: 300,
    currency: "INR",
    rating: 4.8,
    ratingCount: 402,
    accent: "blue",
    email: "ravi.iyer@carenow.health",
  },
  {
    id: "doc-priya-raman",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-52744",
      verifiedAt: "2026-02-02T15:05:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Priya Raman",
    specialty: "child",
    qualifications: "MBBS, MD (Paediatrics), IAP Fellow",
    yearsExperience: 15,
    bio:
      "Newborn to teen care, feeding and growth concerns, and childhood rashes. Comfortable " +
      "talking a worried parent through a 2am fever over video.",
    languages: ["English", "Tamil"],
    consultationFee: 500,
    currency: "INR",
    rating: 5.0,
    ratingCount: 164,
    accent: "purple",
    email: "priya.raman@carenow.health",
  },
  {
    id: "doc-arjun-nair",
    verified: true,
    verification: {
      licenceNumber: "KL-MCI-60931",
      verifiedAt: "2026-01-21T08:30:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Arjun Nair",
    specialty: "heart",
    qualifications: "MBBS, MD, DM (Cardiology)",
    yearsExperience: 18,
    bio:
      "Reads your home BP and ECG reports on camera and adjusts medication without a clinic " +
      "visit. Special interest in cholesterol and post-cardiac-event follow-up.",
    languages: ["English", "Malayalam", "Hindi"],
    consultationFee: 800,
    currency: "INR",
    rating: 4.7,
    ratingCount: 131,
    accent: "teal",
    email: "arjun.nair@carenow.health",
  },
  {
    id: "doc-fatima-sheikh",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-44087",
      verifiedAt: "2026-01-30T10:00:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Fatima Sheikh",
    specialty: "womens-health",
    qualifications: "MBBS, MS (OBG)",
    yearsExperience: 11,
    bio:
      "Postnatal recovery, breastfeeding problems, contraception and irregular cycles. " +
      "A large share of her patients are nursing mothers who can't leave the house.",
    languages: ["English", "Tamil", "Urdu"],
    consultationFee: 550,
    currency: "INR",
    rating: 4.9,
    ratingCount: 187,
    accent: "purple",
    email: "fatima.sheikh@carenow.health",
  },
  {
    id: "doc-vikram-das",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-27815",
      verifiedAt: "2026-02-06T13:20:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Vikram Das",
    specialty: "dental",
    qualifications: "BDS, MDS (Oral Medicine)",
    yearsExperience: 8,
    bio:
      "Assessment of toothache, gum bleeding and post-extraction pain over video, with a " +
      "clear answer on whether you can wait until morning or need a clinic tonight.",
    languages: ["English", "Tamil", "Bengali"],
    consultationFee: 350,
    currency: "INR",
    rating: 4.6,
    ratingCount: 96,
    accent: "blue",
    email: "vikram.das@carenow.health",
  },
  {
    id: "doc-meera-krishnan",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-71330",
      verifiedAt: "2026-02-11T09:45:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Meera Krishnan",
    specialty: "mental-health",
    qualifications: "MBBS, MD (Psychiatry)",
    yearsExperience: 10,
    bio:
      "Anxiety, burnout and insomnia — particularly in students and shift workers. First " +
      "session is a 45-minute assessment; she books evening slots deliberately.",
    languages: ["English", "Tamil"],
    consultationFee: 700,
    currency: "INR",
    rating: 4.9,
    ratingCount: 143,
    accent: "teal",
    email: "meera.krishnan@carenow.health",
  },
  {
    id: "doc-sanjay-rao",
    verified: true,
    verification: {
      licenceNumber: "KA-MCI-39562",
      verifiedAt: "2026-01-18T16:10:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Sanjay Rao",
    specialty: "general",
    qualifications: "MBBS, MD (Internal Medicine)",
    yearsExperience: 14,
    bio:
      "Internal medicine for adults: diabetes reviews, thyroid, fatigue and infections that " +
      "haven't settled. Order-first approach — sends lab requests so you arrive with data.",
    languages: ["English", "Kannada", "Hindi"],
    consultationFee: 400,
    currency: "INR",
    rating: 4.7,
    ratingCount: 311,
    accent: "purple",
    email: "sanjay.rao@carenow.health",
  },
  {
    id: "doc-neha-gupta",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-88204",
      verifiedAt: "2026-02-09T12:00:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Neha Gupta",
    specialty: "skin",
    qualifications: "MBBS, DDVL",
    yearsExperience: 7,
    bio:
      "Fungal infections, acne and pigmentation. Works fast — most patients leave the call " +
      "with a prescription the same evening.",
    languages: ["English", "Hindi", "Punjabi"],
    consultationFee: 380,
    currency: "INR",
    rating: 4.8,
    ratingCount: 127,
    accent: "blue",
    email: "neha.gupta@carenow.health",
  },
  {
    id: "doc-imran-khan",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-15673",
      verifiedAt: "2026-01-26T14:35:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Imran Khan",
    specialty: "child",
    qualifications: "MBBS, DCH",
    yearsExperience: 6,
    bio:
      "Childhood fevers, coughs, rashes and feeding issues. Patient with first-time parents " +
      "and happy to repeat anything you missed.",
    languages: ["English", "Tamil", "Urdu"],
    consultationFee: 320,
    currency: "INR",
    rating: 4.6,
    ratingCount: 88,
    accent: "teal",
    email: "imran.khan@carenow.health",
  },
  {
    id: "doc-lakshmi-suresh",
    verified: true,
    verification: {
      licenceNumber: "TN-MCI-93471",
      verifiedAt: "2026-02-14T09:00:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Lakshmi Suresh",
    specialty: "womens-health",
    qualifications: "MBBS, DNB (OBG)",
    yearsExperience: 13,
    bio:
      "Antenatal advice, PCOD and menopause care. Runs late-evening slots so pregnant " +
      "patients don't have to take a work day off.",
    languages: ["English", "Tamil", "Telugu"],
    consultationFee: 480,
    currency: "INR",
    rating: 4.8,
    ratingCount: 205,
    accent: "purple",
    email: "lakshmi.suresh@carenow.health",
  },
  {
    id: "doc-harish-balan",
    verified: false, // Awaiting manual credential check — must not appear in listings.
    verification: {
      licenceNumber: "TN-MCI-00000",
      verifiedAt: "",
      verifiedBy: "",
    },
    fullName: "Dr. Harish Balan",
    specialty: "dental",
    qualifications: "BDS",
    yearsExperience: 4,
    bio: "Newly registered on CareNow. Credentials submitted and under review.",
    languages: ["English", "Tamil"],
    consultationFee: 300,
    currency: "INR",
    rating: 0,
    ratingCount: 0,
    accent: "blue",
    email: "harish.balan@carenow.health",
  },
];
