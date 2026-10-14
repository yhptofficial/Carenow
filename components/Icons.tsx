import type { SVGProps } from "react";

/**
 * CareNow iconography.
 *
 * Outline style, 1.5px stroke, rounded caps and joins, sized 22–24px in use.
 * Icons inherit `currentColor` so the nav can flip them from grey to white
 * simply by sitting on the teal pill. The star is the one deliberately filled
 * glyph (rating badge).
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 10.2 12 3.5l8.5 6.7" />
      <path d="M5.5 9.2V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.2" />
      <path d="M9.75 20.5v-5.25a1.25 1.25 0 0 1 1.25-1.25h2a1.25 1.25 0 0 1 1.25 1.25v5.25" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

/** Find a doctor — a stethoscope. */
export function FindIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5v4a3.5 3.5 0 0 0 7 0v-4" />
      <path d="M4.5 3.5h3M11.5 3.5h3" />
      <path d="M9.5 11v3.25a4.25 4.25 0 0 0 8.5 0V12.5" />
      <circle cx="18" cy="10.5" r="1.75" />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.75h17M8 3.5v3M16 3.5v3" />
      <path d="M8.5 14h2M13.5 14h2M8.5 17h2" />
    </Svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20.5c1.4-3.2 4.05-4.75 7.25-4.75s5.85 1.55 7.25 4.75" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
    </Svg>
  );
}

/** Filled — used at 12–14px inside the rating badge. */
export function StarIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 2.6l2.7 5.9 6.3.75-4.7 4.35 1.3 6.3L12 16.75 6.4 19.9l1.3-6.3L3 9.25l6.3-.75L12 2.6z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6.5" width="12.5" height="11" rx="3" />
      <path d="m15.5 13 4.2 2.4a.75.75 0 0 0 1.1-.65V9.25a.75.75 0 0 0-1.1-.65L15.5 11" />
    </Svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="3" width="6" height="10.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
    </Svg>
  );
}

export function MicOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 5.5v-.75A2.75 2.75 0 0 0 9.5 4.3" />
      <path d="M9 8.6v2.15a3 3 0 0 0 4.5 2.6" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 9.9 5.6M18.5 11.5v.4" />
      <path d="M12 18v3M4 4l16 16" />
    </Svg>
  );
}

export function VideoOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.5 10V9.5a3 3 0 0 0-3-3H9" />
      <path d="M6.7 6.5H6a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h9.5a3 3 0 0 0 1.3-.3" />
      <path d="m15.5 13 4.2 2.4a.75.75 0 0 0 1.1-.65V9.25a.75.75 0 0 0-1.1-.65L16 10.8" />
      <path d="M4 4l16 16" />
    </Svg>
  );
}

export function PhoneOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.2 5.4c-.6.6-.8 1.5-.6 2.3.9 3.7 3 6.9 6 9.2 1.5 1.2 3.3 2.1 5.2 2.6.9.2 1.8 0 2.4-.7l1-1.1c.5-.6.5-1.5-.1-2l-3.3-2.6a1.5 1.5 0 0 0-1.9 0l-.8.6c-1.4-.8-2.6-1.9-3.5-3.2l.6-.9a1.5 1.5 0 0 0-.1-1.9L5.6 4.3" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 5.75v5.5c0 4.1 2.7 7.5 7 8.75 4.3-1.25 7-4.65 7-8.75v-5.5L12 3z" />
      <path d="m9.25 12 2 2 3.5-3.75" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
      <path d="M8 10V7.75a4 4 0 0 1 8 0V10" />
      <path d="M12 14v2.5" />
    </Svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4l16 16" />
      <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17.6 17.6 0 0 1-2.7 3.4M6.1 8A16.9 16.9 0 0 0 2.5 12S6 18 12 18c1.5 0 2.9-.4 4.1-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0v3.2l1.2 2.55a.75.75 0 0 1-.68 1.05H6a.75.75 0 0 1-.68-1.05L6.5 13.2V10z" />
      <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
    </Svg>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h7.5L18.5 8v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M13.25 3.75V8.5h4.75" />
      <path d="M8 13h7M8 16.5h4.5" />
    </Svg>
  );
}

export function PillIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
      <path d="M9 15 15 9" />
    </Svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 5v3.5H7" />
      <path d="M12 8v4.25l3 1.75" />
    </Svg>
  );
}

export function CardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <path d="M7 14.5h3" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.4 12.2 2.5 2.5 4.7-5.2" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.75v5M12 15.75v.5" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10M8 10.25 12 14l4-3.75" />
      <path d="M5 17.5v1.25A1.75 1.75 0 0 0 6.75 20.5h10.5A1.75 1.75 0 0 0 19 18.75V17.5" />
    </Svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s6.25-5.4 6.25-10.25a6.25 6.25 0 1 0-12.5 0C5.75 15.6 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </Svg>
  );
}

export function CarerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.25v7.5M8.25 12h7.5" />
      <path d="M12 12h0" />
    </Svg>
  );
}

export function WomanIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4.25" />
      <path d="M12 12.25V20M9.25 17.25h5.5" />
    </Svg>
  );
}

export function DotsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.5l-1.6-5.3L5 10.6 10.4 9 12 3.5z" />
    </Svg>
  );
}
