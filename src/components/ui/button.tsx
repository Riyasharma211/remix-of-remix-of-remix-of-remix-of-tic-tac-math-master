import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { haptics } from "@/utils/haptics";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-rajdhani tracking-wide uppercase active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-2 border-primary bg-transparent text-primary hover:bg-primary/10",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        neon: "bg-transparent border-2 border-[hsl(180,100%,50%)] text-[hsl(180,100%,50%)] hover:bg-[hsl(180,100%,50%)]/20 hover:shadow-[0_0_20px_hsl(180,100%,50%,0.5)] transition-all duration-300",
        "neon-purple": "bg-transparent border-2 border-[hsl(280,100%,60%)] text-[hsl(280,100%,60%)] hover:bg-[hsl(280,100%,60%)]/20 hover:shadow-[0_0_20px_hsl(280,100%,60%,0.5)] transition-all duration-300",
        "neon-pink": "bg-transparent border-2 border-[hsl(320,100%,60%)] text-[hsl(320,100%,60%)] hover:bg-[hsl(320,100%,60%)]/20 hover:shadow-[0_0_20px_hsl(320,100%,60%,0.5)] transition-all duration-300",
        "neon-filled": "bg-[hsl(180,100%,50%)] text-background hover:bg-[hsl(180,100%,50%)]/80 shadow-[0_0_20px_hsl(180,100%,50%,0.5)]",
        game: "bg-gradient-to-r from-[hsl(180,100%,50%)] to-[hsl(280,100%,60%)] text-background font-bold hover:opacity-90 shadow-[0_0_20px_hsl(180,100%,50%,0.5)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'none';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, haptic = 'light', onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (haptic !== 'none') {
        haptics[haptic]();
      }
      onClick?.(e);
    };
    
    return (
      <Comp 
        className={cn(buttonVariants({ variant, size, className }))} 
        ref={ref} 
        onClick={handleClick}
        {...props} 
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
