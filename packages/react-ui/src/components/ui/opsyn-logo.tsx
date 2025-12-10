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
      <g transform="translate(52, 9)">
        {/* O */}
        <path
          d="M0 11C0 4.9 3.9 0 9.8 0C15.7 0 19.6 4.9 19.6 11C19.6 17.1 15.7 22 9.8 22C3.9 22 0 17.1 0 11ZM4.2 11C4.2 15 6.5 17.7 9.8 17.7C13.1 17.7 15.4 15 15.4 11C15.4 7 13.1 4.3 9.8 4.3C6.5 4.3 4.2 7 4.2 11Z"
          fill="currentColor"
        />

        {/* p */}
        <path
          d="M25.4 1.2H29.5V8.1C30.6 6.5 32.2 5.7 34.3 5.7C38 5.7 40.5 8.4 40.5 12.6C40.5 16.8 38 19.5 34.3 19.5C32.2 19.5 30.6 18.7 29.5 17.1V19.1H25.4V1.2ZM32.9 9.4C30.8 9.4 29.3 11 29.3 13.4C29.3 15.8 30.8 17.4 32.9 17.4C35 17.4 36.4 15.8 36.4 13.4C36.4 11 35 9.4 32.9 9.4Z"
          fill="currentColor"
        />

        {/* S */}
        <path
          d="M47.3 19.7C43.9 19.7 41.4 17.9 40.9 15.1L44.8 14.3C45.1 15.7 46.1 16.5 47.6 16.5C49 16.5 49.8 15.9 49.8 15.1C49.8 14.5 49.4 14.1 48.3 13.8L45.8 13.2C42.8 12.5 41.3 10.8 41.3 8.3C41.3 5 43.8 2.9 47.3 2.9C50.6 2.9 52.9 4.7 53.5 7.3L49.7 8.1C49.4 6.9 48.6 6.2 47.2 6.2C46.1 6.2 45.4 6.7 45.4 7.5C45.4 8.1 45.8 8.5 46.9 8.8L49.3 9.3C52.4 10 53.9 11.6 53.9 14.2C53.9 17.6 51.3 19.7 47.3 19.7Z"
          fill="currentColor"
        />

        {/* y */}
        <path
          d="M58.8 5.9H62.9L65 12.9L67.1 5.9H71.2L66.9 18.9C65.5 22.8 63.8 24.4 61 24.4C59.7 24.4 58.5 24.2 57.5 23.7L58.3 20.5C58.9 20.8 59.5 21 60.2 21C61.1 21 61.8 20.6 62.3 19.4L62.5 18.9L58.8 5.9Z"
          fill="currentColor"
        />

        {/* n */}
        <path
          d="M75.1 5.9H79.2V12.7C79.2 14.5 80.2 15.5 81.7 15.5C83.2 15.5 84.2 14.5 84.2 12.7V5.9H88.4V13C88.4 17 86 19.5 82.4 19.5C78.8 19.5 75.1 17.1 75.1 13V5.9Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
};

OpSynFullLogo.displayName = 'OpSynFullLogo';
OpSynLogoIcon.displayName = 'OpSynLogoIcon';

export { OpSynFullLogo, OpSynLogoIcon };


