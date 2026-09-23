/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_NORTHTAP_API_URL?: string;
    EXPO_PUBLIC_NORTHTAP_API_KEY?: string;
  }
}
