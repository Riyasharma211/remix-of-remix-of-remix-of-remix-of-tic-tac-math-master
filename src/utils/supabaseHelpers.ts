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
 * Safely execute a Supabase operation with error handling and timeout
 */
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  errorMessage: string = 'Operation failed',
  timeout: number = 10000
): Promise<T | null> => {
  if (!checkSupabaseConfig()) {
    return null;
  }

  try {
    // Add timeout to prevent hanging
    const operationPromise = operation();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    );
    
    const { data, error } = await Promise.race([operationPromise, timeoutPromise]);
    
    if (error) {
      console.error('Supabase error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || errorMessage,
      });
      return null;
    }
    
    return data;
  } catch (error: any) {
    console.error('Unexpected error:', error);
    toast({
      variant: 'destructive',
      title: 'Connection Error',
      description: error?.message?.includes('timeout') 
        ? 'Request timed out. Please check your connection.' 
        : errorMessage,
    });
    return null;
  }
};
