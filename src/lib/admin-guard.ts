import { getCurrentUser } from "@/lib/auth";

/** Returns the current user if they are an admin, otherwise null.
 *  Every admin route must call this first and 403 if it returns null -
 *  admin status is never trusted from the client. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
