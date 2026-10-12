import type { Metadata } from "next";
import { Bullets, Clause, LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How CareNow collects, uses and protects your health information.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy policy"
      backHref="/onboarding"
      summary="Short version: we collect your health information for one reason — so a doctor can treat you. We don't sell it, we don't advertise with it, and the only people who can read your notes are you and the doctor you booked with."
    >
      <Clause n={1} heading="What we collect">
        <p>We collect four categories of information:</p>
        <Bullets
          items={[
            "Account details — your name, email address or phone number, and city.",
            "Health information — your date of birth, allergies, long-term conditions, current medication, and the symptoms and notes you give a doctor before a consultation.",
            "Clinical records — the doctor's assessment, any prescription they issue, and a record that a consultation took place with its start and end time.",
            "Payment information — the last four digits of the card used, the amount, and the payment provider's reference. Card numbers never reach our servers; they go directly to the payment provider.",
          ]}
        />
      </Clause>

      <Clause n={2} heading="Why we're allowed to hold it">
        <p>
          Under the Nigeria Data Protection Act 2023, health information is sensitive personal data.
          We process it on the basis of your explicit consent, which you give separately from
          accepting these terms, and on the basis of providing medical care. When you book a doctor,
          you consent to that doctor reading your intake notes and health history for the purpose of
          treating you.
        </p>
        <p>
          You can withdraw consent at any time from Profile → Consent. Doing so means we can no longer
          connect you with a doctor, but we keep records of care already delivered, because your
          history is clinically relevant and in some places legally required.
        </p>
      </Clause>

      <Clause n={3} heading="Who can see your records">
        <Bullets
          items={[
            "You, whenever you sign in.",
            "The doctor you booked with, for that consultation. They can see the intake notes and history you chose to share, plus anything they wrote themselves.",
            "A small clinical-support team that can see booking metadata — never your clinical notes — to resolve payment disputes, refunds and no-shows. Every access is written to an audit log.",
            "Our infrastructure providers (hosting, database, email) process data on our instructions. They cannot use it for their own purposes.",
          ]}
        />
        <p>
          We do not sell your data. We do not use health information for advertising. We do not share
          it with your employer or an insurer.
        </p>
      </Clause>

      <Clause n={4} heading="How long we keep it">
        <Bullets
          items={[
            "Consultation records and prescriptions — as long as your account exists, so a doctor can practise continuity of care.",
            "Consultation recordings, if you consented to them — deleted automatically after 30 days.",
            "Payment records — retained for the period tax and accounting law requires, typically 6 to 8 years.",
            "Deleted accounts — clinical records are removed within 30 days; financial records survive in anonymised form for the tax period.",
          ]}
        />
      </Clause>

      <Clause n={5} heading="Security">
        <p>
          Data is encrypted in transit and at rest. Access is enforced with row-level security in the
          database, so a query made by one account cannot return another account&apos;s rows — this is
          enforced in Postgres, not merely hidden in the interface. Video consultations are carried by
          a specialist provider over encrypted WebRTC, and camera and microphone are only activated
          when you tap join.
        </p>
        <p>
          If a breach affects your information, we will tell you and the relevant regulator within 72
          hours of becoming aware of it.
        </p>
      </Clause>

      <Clause n={6} heading="Your rights">
        <Bullets
          items={[
            "Access — every record is downloadable from its own screen. For a complete export, email us and we'll send a machine-readable copy.",
            "Correction — fix your own profile details in Profile → Health information. If a doctor's note is wrong, ask us to add a correction rather than removing it.",
            "Erasure — ask us to delete your account and we remove your profile, bookings and prescriptions, except where law requires retention.",
            "Objection and portability — contact us and we'll explain what we can and cannot do, and why.",
          ]}
        />
      </Clause>

      <Clause n={7} heading="Children">
        <p>
          A minor&apos;s consultation must be booked by a parent or guardian, who is responsible for
          the minor&apos;s data. We do not knowingly hold records for anyone under 18 without an adult
          account attached.
        </p>
      </Clause>

      <Clause n={8} heading="Contact">
        <p>
          Data protection queries: privacy@carenow.health. Clinical complaints:
          clinic@carenow.health. Our postal address, the name of our Data Protection Officer and our
          registration with the Nigeria Data Protection Commission will be published here before
          launch.
        </p>
      </Clause>
    </LegalLayout>
  );
}
