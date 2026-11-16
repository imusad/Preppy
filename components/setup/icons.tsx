// Line icons from the design. All decorative: the text label next to each carries the meaning.
import type { ReactNode } from 'react';

interface IconProps { size?: number; strokeWidth?: number }

function Svg({ size = 24, strokeWidth = 1.7, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {children}
    </svg>
  );
}

export const BackIcon = (p: IconProps) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;
export const InfoIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></Svg>;
export const WarnIcon = (p: IconProps) => <Svg {...p}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17v.01" /></Svg>;
export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Svg>;
export const CityIcon = (p: IconProps) => <Svg {...p}><path d="M4 21V10l5-3v14M9 21V4l7 4v13M16 21v-8l4 2v6M2 21h20" /></Svg>;
export const LeafIcon = (p: IconProps) => <Svg {...p}><path d="M5 19c0-8 6-13 14-14-1 8-6 14-14 14z" /><path d="M5 19l7-7" /></Svg>;
export const FaceIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 15.5c1-1 2.2-1.5 3.5-1.5s2.5.5 3.5 1.5M9 10h.01M15 10h.01" /></Svg>;
export const BanIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></Svg>;
export const BowlIcon = (p: IconProps) => <Svg {...p}><path d="M3 11h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" /><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" /></Svg>;
export const PanIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="13" r="6" /><path d="M16 13h6" /></Svg>;
export const BodyIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="6" r="2.5" /><path d="M12 9v6M8 21l4-6 4 6M7 12h10" /></Svg>;
export const UploadIcon = (p: IconProps) => <Svg {...p}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></Svg>;
export const DocIcon = (p: IconProps) => <Svg {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 14h6" /></Svg>;
export const CopyIcon = (p: IconProps) => <Svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Svg>;
