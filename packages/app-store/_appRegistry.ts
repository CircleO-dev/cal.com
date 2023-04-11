import { appStoreMetadata } from "@calcom/app-store/appStoreMetaData";
import prisma, { safeAppSelect, safeCredentialSelect } from "@calcom/prisma";
import type { AppFrontendPayload as App } from "@calcom/types/App";
import type { CredentialFrontendPayload as Credential } from "@calcom/types/Credential";

export async function getAppWithMetadata(app: { dirName: string }) {
  const appMetadata: App | null = appStoreMetadata[app.dirName as keyof typeof appStoreMetadata] as App;
  if (!appMetadata) return null;
  // Let's not leak api keys to the front end
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key, ...metadata } = appMetadata;
  if (metadata.logo && !metadata.logo.includes("/api/app-store/")) {
    const appDirName = `${metadata.isTemplate ? "templates" : ""}/${app.dirName}`;
    metadata.logo = `/api/app-store/${appDirName}/${metadata.logo}`;
  }
  return metadata;
}

/** Mainly to use in listings for the frontend, use in getStaticProps or getServerSideProps */
export async function getAppRegistry() {
  const dbApps = await prisma.app.findMany({
    where: { enabled: true },
    select: { dirName: true, slug: true, categories: true, enabled: true },
  });
  const apps = [] as App[];
  for await (const dbapp of dbApps) {
    const app = await getAppWithMetadata(dbapp);
    if (!app) continue;
    // Skip if app isn't installed
    /* This is now handled from the DB */
    // if (!app.installed) return apps;

    const { rating, reviews, trending, verified, ...remainingAppProps } = app;
    apps.push({
      rating: rating || 0,
      reviews: reviews || 0,
      trending: trending || true,
      verified: verified || true,
      ...remainingAppProps,
      category: app.category || "other",
      installed:
        true /* All apps from DB are considered installed by default. @TODO: Add and filter our by `enabled` property */,
    });
  }
  const calendars = [
    {
      rating: 5,
      reviews: 69,
      trending: true,
      verified: true,
      appData: null,
      __template: "",
      name: "Outlook Calendar",
      description:
        "Microsoft Office 365 is a suite of apps that helps you stay connected with others and get things done. It includes but is not limited to Microsoft Word, PowerPoint, Excel, Teams, OneNote and OneDrive. Office 365 allows you to work remotely with others on a team and collaborate in an online environment. Both web versions and desktop/mobile applications are available.",
      type: "office365_calendar",
      title: "Outlook Calendar",
      imageSrc: "/api/app-store/office365calendar/icon.svg",
      variant: "calendar",
      category: "calendar",
      categories: ["calendar"],
      logo: "/api/app-store/office365calendar/icon.svg",
      publisher: "Cal.com",
      slug: "office365-calendar",
      url: "https://cal.com/",
      email: "help@cal.com",
      dirName: "office365calendar",
      installed: true,
    },
    {
      rating: 5,
      reviews: 69,
      trending: true,
      verified: true,
      appData: null,
      __template: "",
      name: "Lark Calendar",
      description:
        "Lark Calendar is a time management and scheduling service developed by Lark. Allows users to create and edit events, with options available for type and time. Available to anyone that has a Lark account on both mobile and web versions.",
      installed: true,
      type: "lark_calendar",
      title: "Lark Calendar",
      imageSrc: "/api/app-store/larkcalendar/icon.svg",
      variant: "calendar",
      categories: ["calendar"],
      logo: "/api/app-store/larkcalendar/icon.svg",
      publisher: "Lark",
      slug: "lark-calendar",
      url: "https://larksuite.com/",
      email: "alan@larksuite.com",
      dirName: "larkcalendar",
      category: "other",
    },
    {
      rating: 5,
      reviews: 69,
      trending: true,
      verified: true,
      appData: null,
      __template: "",
      name: "Google Calendar",
      description:
        "Google Calendar is a time management and scheduling service developed by Google. Allows users to create and edit events, with options available for type and time. Available to anyone that has a Gmail account on both mobile and web versions.",
      installed: true,
      type: "google_calendar",
      title: "Google Calendar",
      imageSrc: "/api/app-store/googlecalendar/icon.svg",
      variant: "calendar",
      category: "calendar",
      categories: ["calendar"],
      logo: "/api/app-store/googlecalendar/icon.svg",
      publisher: "Cal.com",
      slug: "google-calendar",
      url: "https://cal.com/",
      email: "help@cal.com",
      dirName: "googlecalendar",
    },
  ];
  apps.push(...calendars);
  return apps;
}

export async function getAppRegistryWithCredentials(userId: number) {
  const dbApps = await prisma.app.findMany({
    where: { enabled: true },
    select: {
      ...safeAppSelect,
      credentials: {
        where: { userId },
        select: safeCredentialSelect,
      },
    },
    orderBy: {
      credentials: {
        _count: "desc",
      },
    },
  });
  const apps = [] as (App & {
    credentials: Credential[];
  })[];
  for await (const dbapp of dbApps) {
    const app = await getAppWithMetadata(dbapp);
    if (!app) continue;
    // Skip if app isn't installed
    /* This is now handled from the DB */
    // if (!app.installed) return apps;

    const { rating, reviews, trending, verified, ...remainingAppProps } = app;
    apps.push({
      rating: rating || 0,
      reviews: reviews || 0,
      trending: trending || true,
      verified: verified || true,
      ...remainingAppProps,
      categories: dbapp.categories,
      credentials: dbapp.credentials,
      installed: true,
    });
  }
  return apps;
}
