import { AppCategories } from "@prisma/client";
import type { GetStaticPropsContext, InferGetStaticPropsType } from "next";
import Link from "next/link";
import { useRouter } from "next/router";

import { getAppRegistry } from "@calcom/app-store/_appRegistry";
import Shell from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import prisma from "@calcom/prisma";
import { AppCard, SkeletonText } from "@calcom/ui";

export default function Apps({ apps }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { t, isLocaleReady } = useLocale();
  const router = useRouter();
  const { category } = router.query;

  return (
    <>
      <Shell
        isPublic
        backPath="/apps"
        smallHeading
        heading={
          <>
            <Link
              href="/apps"
              className="inline-flex items-center justify-start gap-1 rounded-sm py-2 text-gray-900">
              {isLocaleReady ? t("app_store") : <SkeletonText className="h-4 w-24" />}{" "}
            </Link>
            {category && (
              <span className="gap-1 text-gray-600">
                <span>&nbsp;/&nbsp;</span>
                {t("category_apps", { category: category[0].toUpperCase() + category?.slice(1) })}
              </span>
            )}
          </>
        }>
        <div className="mb-16">
          <div className="grid-col-1 grid grid-cols-1 gap-3 md:grid-cols-3">
            {apps.map((app) => {
              return <AppCard key={app.slug} app={app} />;
            })}
          </div>
        </div>
      </Shell>
    </>
  );
}

export const getStaticPaths = async () => {
  const paths = Object.keys(AppCategories);

  return {
    paths: paths.map((category) => ({ params: { category } })),
    fallback: false,
  };
};

export const getStaticProps = async (context: GetStaticPropsContext) => {
  const category = context.params?.category as AppCategories;

  const appQuery = await prisma.app.findMany({
    where: {
      categories: {
        has: category,
      },
    },
    select: {
      slug: true,
    },
  });

  const dbAppsSlugs = appQuery.map((category) => category.slug);
  const appStore = await getAppRegistry();
  appStore.push({
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
  });
  appStore.push({
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
  });
  appStore.push({
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
  });
  const apps = appStore.filter((app) => dbAppsSlugs.includes(app.slug));

  return {
    props: {
      apps,
    },
  };
};
