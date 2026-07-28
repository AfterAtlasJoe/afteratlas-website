import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { notifyAdminsOfNewSignup } from "@/lib/notify-admins";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  events: {
    // Fires for adapter-created users — i.e. OAuth signups (Credentials
    // never goes through the adapter; that path notifies from
    // src/app/api/register/route.ts instead, right after prisma.user.create).
    async createUser({ user }) {
      if (!user.email) return;
      try {
        await notifyAdminsOfNewSignup({ email: user.email, name: user.name });
      } catch (error) {
        console.error("Failed to notify admins of new OAuth signup:", error);
      }
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [
    // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET automatically (NextAuth v5's
    // env-var inference for well-known providers). allowDangerousEmailAccountLinking
    // is on because Google verifies the email itself, so it's safe to link a
    // Google sign-in to an existing password account with the same address —
    // without it, someone who registered with email/password would hit a
    // confusing "account not linked" error the first time they try Google.
    Google({ allowDangerousEmailAccountLinking: true }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
