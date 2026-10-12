import type { Doctor, Specialty, SpecialtyId } from "./types";

/** Filter chips read left-to-right in this order; "All" is rendered separately. */
export const SPECIALTIES: Specialty[] = [
  {
    id: "general",
    label: "General",
    clinical: "General Medicine",
    keywords: [
      "general",
      "fever",
      "malaria",
      "typhoid",
      "cold",
      "flu",
      "physician",
      "checkup",
      "tired",
      "body ache",
      "sickle cell",
    ],
  },
  {
    id: "skin",
    label: "Skin",
    clinical: "Dermatology",
    keywords: [
      "skin",
      "rash",
      "acne",
      "hair",
      "dermatologist",
      "itch",
      "eczema",
      "fungal",
      "ringworm",
      "bleaching",
    ],
  },
  {
    id: "heart",
    label: "Heart",
    clinical: "Cardiology",
    keywords: [
      "heart",
      "chest",
      "bp",
      "blood pressure",
      "palpitation",
      "cardio",
      "cholesterol",
      "hypertension",
    ],
  },
  {
    id: "child",
    label: "Child",
    clinical: "Paediatrics",
    keywords: [
      "child",
      "kid",
      "baby",
      "infant",
      "paediatric",
      "vaccination",
      "immunisation",
      "infant feeding",
      "yellow fever",
    ],
  },
  {
    id: "dental",
    label: "Dental",
    clinical: "Dentistry",
    keywords: ["dental", "tooth", "teeth", "gum", "dentist", "cavity", "jaw", "toothache"],
  },
  {
    id: "womens-health",
    label: "Women",
    clinical: "Obstetrics & Gynaecology",
    keywords: [
      "women",
      "period",
      "pregnancy",
      "antenatal",
      "postnatal",
      "gynae",
      "pcos",
      "breastfeeding",
      "fibroid",
    ],
  },
  {
    id: "mental-health",
    label: "Mind",
    clinical: "Psychiatry & Counselling",
    keywords: [
      "mind",
      "anxiety",
      "stress",
      "sleep",
      "depression",
      "counselling",
      "panic",
      "burnout",
      "exam",
    ],
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
 * Clinicians are registered with the Medical and Dental Council of Nigeria
 * (MDCN); `licence_number` follows its registration format. Fees are in naira
 * and sit in the band private Nigerian telemedicine actually charges — a GP
 * consultation from about ₦5,000, specialists higher.
 *
 * `verified: false` records stay in the database so the admin flow can show
 * them, but `listDoctors()` filters them out — the PRD requires manual
 * verification before a doctor is discoverable.
 *
 * Licence numbers, ratings and registration dates here are fictional.
 */
export const DOCTORS: Doctor[] = [
  {
    id: "doc-chidinma-okonkwo",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/41208",
      verifiedAt: "2026-01-14T09:12:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Chidinma Okonkwo",
    specialty: "skin",
    city: "Lagos",
    qualifications: "MBBS, FMCP (Dermatology)",
    yearsExperience: 12,
    bio:
      "Treats acne, pigmentation and hair loss with a conservative, evidence-first approach. " +
      "Sees a lot of skincare damage from mixing unregulated creams, and will tell you exactly " +
      "which ones to stop. Sends a photo-review follow-up two weeks after every course of treatment.",
    languages: ["English", "Igbo", "Nigerian Pidgin"],
    consultationFee: 10000,
    currency: "NGN",
    rating: 4.9,
    ratingCount: 218,
    accent: "teal",
    email: "chidinma.okonkwo@carenow.health",
  },
  {
    id: "doc-adebayo-oyeleke",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/31190",
      verifiedAt: "2026-01-09T11:40:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Adebayo Oyeleke",
    specialty: "general",
    city: "Ibadan",
    qualifications: "MBBS, DFM",
    yearsExperience: 9,
    bio:
      "Family physician for everyday illness — fevers, malaria, infections, travel advice and " +
      "long-term blood-pressure reviews. Keeps prescriptions short and explains every drug he " +
      "sends, including what it will cost you at the pharmacy.",
    languages: ["English", "Yoruba", "Nigerian Pidgin"],
    consultationFee: 5000,
    currency: "NGN",
    rating: 4.8,
    ratingCount: 402,
    accent: "blue",
    email: "adebayo.oyeleke@carenow.health",
  },
  {
    id: "doc-zainab-bello",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/52744",
      verifiedAt: "2026-02-02T15:05:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Zainab Bello",
    specialty: "child",
    city: "Kano",
    qualifications: "MBBS, FMCPaed",
    yearsExperience: 15,
    bio:
      "Newborn to teen care, feeding and growth concerns, and childhood rashes. Comfortable " +
      "talking a worried parent through a 2am fever over video, and quick to say when a child " +
      "needs to be seen in person instead.",
    languages: ["English", "Hausa", "Fulfulde"],
    consultationFee: 8000,
    currency: "NGN",
    rating: 5.0,
    ratingCount: 164,
    accent: "purple",
    email: "zainab.bello@carenow.health",
  },
  {
    id: "doc-emeka-nwachukwu",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/60931",
      verifiedAt: "2026-01-21T08:30:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Emeka Nwachukwu",
    specialty: "heart",
    city: "Enugu",
    qualifications: "MBBS, FWACP (Cardiology)",
    yearsExperience: 18,
    bio:
      "Reads your home BP log and recent ECG on camera and adjusts medication without a clinic " +
      "visit. Special interest in cholesterol, heart failure follow-up and blood pressure that " +
      "has been 'almost controlled' for years.",
    languages: ["English", "Igbo", "Nigerian Pidgin"],
    consultationFee: 20000,
    currency: "NGN",
    rating: 4.7,
    ratingCount: 131,
    accent: "teal",
    email: "emeka.nwachukwu@carenow.health",
  },
  {
    id: "doc-aisha-suleiman",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/44087",
      verifiedAt: "2026-01-30T10:00:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Aisha Suleiman",
    specialty: "womens-health",
    city: "Abuja",
    qualifications: "MBBS, FMCOG",
    yearsExperience: 11,
    bio:
      "Postnatal recovery, breastfeeding problems, contraception and irregular cycles. A large " +
      "share of her patients are nursing mothers who can't leave the house, so she runs evening " +
      "slots deliberately.",
    languages: ["English", "Hausa", "Nupe"],
    consultationFee: 12000,
    currency: "NGN",
    rating: 4.9,
    ratingCount: 187,
    accent: "purple",
    email: "aisha.suleiman@carenow.health",
  },
  {
    id: "doc-eghosa-omoregie",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/27815",
      verifiedAt: "2026-02-06T13:20:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Eghosa Omoregie",
    specialty: "dental",
    city: "Benin City",
    qualifications: "BDS, FMCDS",
    yearsExperience: 8,
    bio:
      "Assessment of toothache, gum bleeding and post-extraction pain over video, with a clear " +
      "answer on whether you can wait until morning or need a clinic tonight. Blunt about what " +
      "a video call can't fix — a tooth that needs drilling needs a chair.",
    languages: ["English", "Edo", "Nigerian Pidgin"],
    consultationFee: 6000,
    currency: "NGN",
    rating: 4.6,
    ratingCount: 96,
    accent: "blue",
    email: "eghosa.omoregie@carenow.health",
  },
  {
    id: "doc-ngozi-umeh",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/71330",
      verifiedAt: "2026-02-11T09:45:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Ngozi Umeh",
    specialty: "mental-health",
    city: "Lagos",
    qualifications: "MBBS, FWACP (Psychiatry)",
    yearsExperience: 10,
    bio:
      "Anxiety, burnout and insomnia — particularly in students, bankers and shift workers. First " +
      "session is a 45-minute assessment; she books evening slots so you don't have to explain " +
      "yourself at work.",
    languages: ["English", "Igbo", "Nigerian Pidgin"],
    consultationFee: 15000,
    currency: "NGN",
    rating: 4.9,
    ratingCount: 143,
    accent: "teal",
    email: "ngozi.umeh@carenow.health",
  },
  {
    id: "doc-ibrahim-danjuma",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/39562",
      verifiedAt: "2026-01-18T16:10:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Ibrahim Danjuma",
    specialty: "general",
    city: "Kaduna",
    qualifications: "MBBS, FMCP, MPH",
    yearsExperience: 14,
    bio:
      "Internal medicine for adults: diabetes reviews, thyroid, fatigue and infections that " +
      "haven't settled. Order-first approach — sends lab requests to a centre near you so you " +
      "arrive at the next call with data instead of guesses.",
    languages: ["English", "Hausa", "Kanuri"],
    consultationFee: 8000,
    currency: "NGN",
    rating: 4.7,
    ratingCount: 311,
    accent: "purple",
    email: "ibrahim.danjuma@carenow.health",
  },
  {
    id: "doc-folake-adeyemi",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/88204",
      verifiedAt: "2026-02-09T12:00:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Folake Adeyemi",
    specialty: "skin",
    city: "Lagos",
    qualifications: "MBBS, DDVL",
    yearsExperience: 7,
    bio:
      "Fungal infections, acne and pigmentation. Works fast — most patients leave the call with a " +
      "prescription the same evening, and she'll check whether what you're already using is " +
      "genuine or a repackaged product.",
    languages: ["English", "Yoruba"],
    consultationFee: 8000,
    currency: "NGN",
    rating: 4.8,
    ratingCount: 127,
    accent: "blue",
    email: "folake.adeyemi@carenow.health",
  },
  {
    id: "doc-uche-obi",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/15673",
      verifiedAt: "2026-01-26T14:35:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Uche Obi",
    specialty: "child",
    city: "Port Harcourt",
    qualifications: "MBBS, FWACP (Paediatrics)",
    yearsExperience: 6,
    bio:
      "Childhood fevers, coughs, rashes and feeding issues — including the malaria cases that " +
      "come with the rains. Patient with first-time parents and happy to repeat anything you missed.",
    languages: ["English", "Igbo", "Nigerian Pidgin"],
    consultationFee: 7000,
    currency: "NGN",
    rating: 4.6,
    ratingCount: 88,
    accent: "teal",
    email: "uche.obi@carenow.health",
  },
  {
    id: "doc-halima-yusuf",
    verified: true,
    verification: {
      licenceNumber: "MDCN/R/93471",
      verifiedAt: "2026-02-14T09:00:00.000Z",
      verifiedBy: "admin@carenow.health",
    },
    fullName: "Dr. Halima Yusuf",
    specialty: "womens-health",
    city: "Abuja",
    qualifications: "MBBS, FWACP (OBGYN)",
    yearsExperience: 13,
    bio:
      "Antenatal advice, PCOS and menopause care. Reviews your scan results on camera and " +
      "explains what they actually mean, in plain language, without rushing you off the call.",
    languages: ["English", "Hausa"],
    consultationFee: 10000,
    currency: "NGN",
    rating: 4.8,
    ratingCount: 205,
    accent: "purple",
    email: "halima.yusuf@carenow.health",
  },
  {
    id: "doc-haruna-bala",
    verified: false, // Awaiting manual credential check — must not appear in listings.
    verification: {
      licenceNumber: "",
      verifiedAt: "",
      verifiedBy: "",
    },
    fullName: "Dr. Haruna Bala",
    specialty: "dental",
    city: "Kano",
    qualifications: "BDS",
    yearsExperience: 4,
    bio: "Newly registered on CareNow. Credentials submitted to MDCN records and under review.",
    languages: ["English", "Hausa"],
    consultationFee: 5000,
    currency: "NGN",
    rating: 0,
    ratingCount: 0,
    accent: "blue",
    email: "haruna.bala@carenow.health",
  },
];
