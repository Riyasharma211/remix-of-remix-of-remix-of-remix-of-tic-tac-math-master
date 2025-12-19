import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Check if Supabase is configured and show a helpful message if not
 */
export const checkSupabaseConfig = (): boolean => {
  if (!isSupabaseConfigured()) {
    toast({
      variant: 'destructive',
      title: 'Multiplayer Unavailable',
      description: 'Supabase is not configured. Please set up your environment variables to use multiplayer features.',
    });
    return false;
  }
  return true;
};

/**
 * Safely execute a Supabase operation with error handling
 */
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  errorMessage: string = 'Operation failed'
): Promise<T | null> => {
  if (!checkSupabaseConfig()) {
    return null;
  }

  try {
    const { data, error } = await operation();
    
    if (error) {
      console.error('Supabase error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Unexpected error:', error);
    toast({
      variant: 'destructive',
      title: 'Error',
      description: errorMessage,
    });
    return null;
  }
};
