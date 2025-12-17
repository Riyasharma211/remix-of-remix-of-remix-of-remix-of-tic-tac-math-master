import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-gradient-to-b group-[.toaster]:from-gray-800/95 group-[.toaster]:to-gray-900/95 group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-black/50 group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-[22px] group-[.toaster]:px-4 group-[.toaster]:py-3",
          description: "group-[.toast]:text-white/70",
          actionButton: "group-[.toast]:bg-white/20 group-[.toast]:text-white group-[.toast]:rounded-full",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white/70 group-[.toast]:rounded-full",
          success: "group-[.toaster]:from-green-900/95 group-[.toaster]:to-gray-900/95",
          error: "group-[.toaster]:from-red-900/95 group-[.toaster]:to-gray-900/95",
          info: "group-[.toaster]:from-blue-900/95 group-[.toaster]:to-gray-900/95",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
