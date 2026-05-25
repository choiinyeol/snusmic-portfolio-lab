import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium leading-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950/15 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-slate-950 text-white hover:bg-slate-800',
        secondary: 'bg-slate-100 text-slate-950 hover:bg-slate-200',
        outline: 'border border-slate-200 bg-white text-slate-950 hover:bg-slate-50',
        ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
        link: 'min-h-0 p-0 text-slate-950 underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-10 px-4 py-2.5',
        sm: 'min-h-9 rounded-md px-3 py-2 text-sm',
        lg: 'min-h-11 rounded-md px-5 py-3 text-base',
        icon: 'min-h-10 min-w-10 p-2',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  Omit<VariantProps<typeof buttonVariants>, 'variant'> & {
    variant: NonNullable<VariantProps<typeof buttonVariants>['variant']>;
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return <Comp className={cn(buttonVariants({ variant, size, className }))} data-slot="button" {...props} />;
}

export { Button, buttonVariants };
