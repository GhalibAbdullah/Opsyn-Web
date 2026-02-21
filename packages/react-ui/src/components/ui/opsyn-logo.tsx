import * as React from 'react';

type OpSynLogoProps = React.SVGProps<SVGSVGElement> & {
  variant?: 'full' | 'icon';
};

const PRIMARY_BLUE = '#2563EB';
const PRIMARY_BLUE_DARK = '#1D4ED8';

const OpSynLogoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 40 40"
    aria-hidden="true"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <defs>
      <linearGradient
        id="opsyn-logo-gradient"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor={PRIMARY_BLUE} />
        <stop offset="100%" stopColor={PRIMARY_BLUE_DARK} />
      </linearGradient>
    </defs>
    <rect
      x="4"
      y="4"
      width="32"
      height="32"
      rx="10"
      fill="url(#opsyn-logo-gradient)"
    />
    <circle cx="16" cy="16" r="4.5" fill="white" opacity="0.96" />
    <circle cx="24" cy="24" r="4.5" fill="white" opacity="0.9" />
    <path
      d="M18.5 21.5C19.6 22.6 21.1 23.3 22.8 23.3C24.1 23.3 25.3 22.9 26.3 22.2"
      fill="none"
      stroke="white"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.95"
    />
  </svg>
);

const OpSynFullLogo = ({ variant = 'full', ...props }: OpSynLogoProps) => {
  if (variant === 'icon') {
    return <OpSynLogoIcon {...props} />;
  }

  return (
    <svg
      viewBox="0 0 200 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="OpSyn"
      {...props}
    >
      <defs>
        <linearGradient
          id="opsyn-logo-full-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor={PRIMARY_BLUE} />
          <stop offset="100%" stopColor={PRIMARY_BLUE_DARK} />
        </linearGradient>
      </defs>

      {/* Icon */}
      <g transform="translate(0, 0)">
        <rect
          x="4"
          y="4"
          width="32"
          height="32"
          rx="10"
          fill="url(#opsyn-logo-full-gradient)"
        />
        <circle cx="16" cy="16" r="4.5" fill="white" opacity="0.96" />
        <circle cx="24" cy="24" r="4.5" fill="white" opacity="0.9" />
        <path
          d="M18.5 21.5C19.6 22.6 21.1 23.3 22.8 23.3C24.1 23.3 25.3 22.9 26.3 22.2"
          fill="none"
          stroke="white"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
      </g>

      {/* Wordmark */}
      <text
        x="52"
        y="28"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        fontSize="24"
        fill="currentColor"
        letterSpacing="-0.02em"
      >
        Opsyn
      </text>
    </svg>
  );
};

OpSynFullLogo.displayName = 'OpSynFullLogo';
OpSynLogoIcon.displayName = 'OpSynLogoIcon';

export { OpSynFullLogo, OpSynLogoIcon };


