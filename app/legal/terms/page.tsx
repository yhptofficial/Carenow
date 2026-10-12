import type { Metadata } from "next";
import { Bullets, Clause, LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The agreement between you and CareNow when you book a video consultation.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of service"
      backHref="/onboarding"
      summary="Short version: CareNow connects you with an independently licensed doctor over video. The doctor provides the medical care; we provide the platform, the payment handling and your records. It is not for emergencies."
    >
      <Clause n={1} heading="What CareNow is">
        <p>
          CareNow is a technology platform that lets you find a verified doctor and consult them over
          video. We are not a clinic and we do not practise medicine. The doctor you book is an
          independent, licensed practitioner who is solely responsible for the clinical advice they
          give you.
        </p>
        <p>
          Every doctor on CareNow is manually verified against their medical registration before they
          appear in listings, and can be removed if a complaint is upheld.
        </p>
      </Clause>

      <Clause n={2} heading="What CareNow is not">
        <Bullets
          items={[
            "Not an emergency service. If you have chest pain, difficulty breathing, severe bleeding, sudden weakness, or thoughts of harming yourself, call your local emergency number immediately. CareNow cannot send help.",
            "Not a physical examination. A doctor cannot feel a lump, listen to your chest or run a test during a video call. They may tell you that you need to be seen in person.",
            "Not a pharmacy or a lab. We don't dispense medicine, deliver drugs or process test results in this version.",
            "Not an insurer. We don't file claims or guarantee reimbursement.",
          ]}
        />
      </Clause>

      <Clause n={3} heading="Your account">
        <p>
          You must be 18 or over, or booking on behalf of a minor as their parent or guardian. Keep
          your sign-in details private. Anything done through your account is treated as done by you
          until you report it compromised.
        </p>
        <p>
          Give accurate information. A doctor relies on what you tell them; an undisclosed allergy or
          a medicine you forgot to mention affects their prescribing decision.
        </p>
      </Clause>

      <Clause n={4} heading="Bookings, payment and refunds">
        <Bullets
          items={[
            "A consultation is confirmed only once payment is captured. Unpaid bookings hold the slot but the room stays locked.",
            "Consultation fees are set by each doctor and shown before you pay. There is no platform fee in this version.",
            "Cancel more than 2 hours before the start time and you receive a full refund to the original payment method, typically within 5–7 working days.",
            "Cancel inside 2 hours and the fee is not refundable, because the doctor has held that time. You can reschedule free of charge instead.",
            "If your doctor does not join within 10 minutes of the start time, you may leave and claim a full refund.",
            "If you do not join and the doctor closes the room, the consultation is marked as not attended and is not refundable unless you tell us within 24 hours that the app failed.",
          ]}
        />
      </Clause>

      <Clause n={5} heading="Rescheduling">
        <p>
          You can move a consultation to another slot the same doctor has open, at no cost, as many
          times as you need. Your payment carries over. A new reminder is sent for the new time.
        </p>
      </Clause>

      <Clause n={6} heading="Prescriptions and records">
        <p>
          A prescription issued through CareNow is a real prescription from a licensed doctor, carrying
          their registration number. Whether a particular pharmacist will fill it, and whether it is
          valid for controlled medicines, depends on where you live. Controlled substances cannot be
          prescribed over a video consultation.
        </p>
        <p>
          Your records belong to you. You can download or print any prescription or visit summary, and
          you can ask us to delete your account and the records in it.
        </p>
      </Clause>

      <Clause n={7} heading="Recording">
        <p>
          Consultations are not recorded by default. If you switch recording on in your consent
          settings, both you and the doctor see an on-screen notice for the whole of the call, and the
          recording is deleted automatically after 30 days. A doctor may not record without your
          agreement.
        </p>
      </Clause>

      <Clause n={8} heading="Acceptable use">
        <Bullets
          items={[
            "Don't use CareNow to obtain medicine you don't need, or to misrepresent your identity or symptoms.",
            "Don't upload anything unlawful, or anything you don't have the right to share.",
            "Don't record a consultation without the doctor's agreement, or share clinical content from a consultation publicly.",
            "Don't attempt to access another patient's records. Attempts are logged and will end your account.",
          ]}
        />
      </Clause>

      <Clause n={9} heading="Complaints and clinical concerns">
        <p>
          If you are unhappy with the care you received, contact us within 30 days at
          clinic@carenow.health with the booking reference. We will ask the doctor for a response and
          tell you the outcome. If a complaint raises a serious safety concern, the doctor is suspended
          from new bookings while we investigate.
        </p>
      </Clause>

      <Clause n={10} heading="Liability">
        <p>
          Nothing in these terms limits your rights in relation to clinical negligence. The doctor is
          responsible for the medical advice they give. CareNow is responsible for the platform working
          — for bookings, payments, records and the video connection — and for the verification of the
          doctors listed.
        </p>
        <p>
          We are not liable for a poor video connection caused by your network, for clinical
          decisions made by a doctor, or for a pharmacist declining to fill a prescription.
        </p>
      </Clause>

      <Clause n={11} heading="Changes">
        <p>
          If we change these terms materially, we will show you the new version and ask you to agree
          again before your next booking. The version you agreed to is stored with your consent
          record. This version is 2026-02-01.
        </p>
      </Clause>

      <Clause n={12} heading="Governing law">
        <p>
          These terms are governed by the laws of the jurisdiction in which CareNow is registered.
          Consumer rights you have locally are not affected. The exact jurisdiction and a registered
          address will be added here before launch.
        </p>
      </Clause>
    </LegalLayout>
  );
}
