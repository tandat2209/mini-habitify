import { supabaseDatabaseCa } from "../../../lib/supabase/database-ca";
export function gatewayDatabaseConfig(connectionString: string) {
  const url = new URL(connectionString);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    return { connectionString, ssl: undefined };
  // pg connection-string SSL parameters override the explicit SSL object. Remove
  // them so hosted connections always validate both the certificate and hostname.
  for (const name of ["sslmode", "sslrootcert", "sslcert", "sslkey"])
    url.searchParams.delete(name);
  const supabase =
    url.hostname.endsWith(".pooler.supabase.com") ||
    url.hostname.endsWith(".supabase.co");
  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: true,
      ...(supabase ? { ca: supabaseDatabaseCa } : {}),
    },
  };
}
