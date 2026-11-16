import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  onClick,
  className = '',
}) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const baseClass = `relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-semibold select-none bg-gradient-to-br from-[#1B1F29] to-[#2F3542] text-white border border-black/10 ${SIZE_MAP[size]} ${
    onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
  } ${className}`;

  if (src) {
    return (
      <div onClick={onClick} className={baseClass}>
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="pointer-events-none">{initials}</span>
      </div>
    );
  }

  return (
    <div onClick={onClick} className={baseClass} aria-label={name}>
      {initials || 'FJ'}
    </div>
  );
};
