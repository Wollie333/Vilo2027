# Source to get $SB (project URL) + $KEY (service role) from the absolute .env.local
ENVF="C:/Users/Wollie/Desktop/Vilo2027/apps/web/.env.local"
export SB=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
export KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
