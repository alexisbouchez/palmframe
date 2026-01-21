import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-border bg-transparent hover:bg-background-interactive",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-background-interactive",
        link: "text-primary underline-offset-4 hover:underline",
        nominal: "bg-status-nominal text-background hover:bg-status-nominal/90",
        warning: "bg-status-warning text-background hover:bg-status-warning/90",
        critical: "bg-status-critical text-white hover:bg-status-critical/90",
        info: "bg-status-info text-white hover:bg-status-info/90"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "size-9",
        "icon-sm": "size-8"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
