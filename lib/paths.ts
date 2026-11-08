/**
 * The CV builder is served at https://members.masaelhaofek.co.il/cv: the members' site
 * (repo talgurevich/member-tools) forwards /cv here, and its login covers this app.
 */
export const BASE_PATH = "/cv";

/** The members' site: login, sign-out and the tools home page. */
export const MEMBERS_URL =
  process.env.NEXT_PUBLIC_MEMBERS_URL ?? "https://members.masaelhaofek.co.il";

/** fetch() doesn't add the basePath the way <Link> and router.push do. */
export const api = (path: string) => `${BASE_PATH}${path}`;
