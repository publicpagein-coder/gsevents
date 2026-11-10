import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | undefined
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300',
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
