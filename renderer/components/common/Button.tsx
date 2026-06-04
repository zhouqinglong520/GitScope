/**
 * 通用按钮组件
 */

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否加载中 */
  loading?: boolean;
  /** 图标 */
  icon?: React.ReactNode;
}

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'bg-[#3c3c3c] text-white hover:bg-[#4f4f4f]',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-400 hover:bg-[#3c3c3c] hover:text-white',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm',
    lg: 'px-6 py-2 text-base',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded font-medium
        transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}

export default Button;
