import { OpSynLogoIcon } from './opsyn-logo';

const FullLogo = () => {
  return (
    <div className="h-[60px] flex items-center justify-center gap-3">
      <OpSynLogoIcon className="h-10 w-10" aria-label="OpSyn" />
      <span className="text-3xl font-semibold tracking-tight">OpSyn</span>
    </div>
  );
};

FullLogo.displayName = 'FullLogo';

export { FullLogo };
