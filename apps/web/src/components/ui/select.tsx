import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | undefined
  placeholder?: string | undefined
  options: Array<{ value: string; label: string }>
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, placeholder, options, ...props }, ref) => {
    return (
      <div className="w-full">
        <select
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300',
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <p className="mt-1.5 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
