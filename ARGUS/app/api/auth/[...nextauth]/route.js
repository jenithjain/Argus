import _NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Turbopack / Webpack CJS-ESM interop: packages may arrive as { default: fn }
const NextAuth = _NextAuth.default ?? _NextAuth;

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
