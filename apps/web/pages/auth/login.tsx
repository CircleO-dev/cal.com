import classNames from "classnames";
import { jwtVerify } from "jose";
import type { GetServerSidePropsContext } from "next";
import { getCsrfToken, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { FaGoogle } from "react-icons/fa";

import { SAMLLogin } from "@calcom/features/auth/SAMLLogin";
import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { isSAMLLoginEnabled, samlProductID, samlTenantID } from "@calcom/features/ee/sso/lib/saml";
import { WEBAPP_URL, WEBSITE_URL } from "@calcom/lib/constants";
import { getSafeRedirectUrl } from "@calcom/lib/getSafeRedirectUrl";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { collectPageParameters, telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import prisma from "@calcom/prisma";
import { Alert, Button, EmailField, PasswordField } from "@calcom/ui";
import { FiArrowLeft } from "@calcom/ui/components/icon";

import type { inferSSRProps } from "@lib/types/inferSSRProps";
import type { WithNonceProps } from "@lib/withNonce";
import withNonce from "@lib/withNonce";

import AddToHomescreen from "@components/AddToHomescreen";
import TwoFactor from "@components/auth/TwoFactor";
import AuthContainer from "@components/ui/AuthContainer";

import { IS_GOOGLE_LOGIN_ENABLED } from "@server/lib/constants";
import { ssrInit } from "@server/lib/ssr";

interface LoginValues {
  email: string;
  password: string;
  totpCode: string;
  csrfToken: string;
}

export default function Login({
  csrfToken,
  isGoogleLoginEnabled,
  isSAMLLoginEnabled,
  samlTenantID,
  samlProductID,
  totpEmail,
}: inferSSRProps<typeof _getServerSideProps> & WithNonceProps) {
  const { t } = useLocale();
  const router = useRouter();
  const methods = useForm<LoginValues>();

  const { register, formState } = methods;
  const [twoFactorRequired, setTwoFactorRequired] = useState(!!totpEmail || false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errorMessages: { [key: string]: string } = {
    // [ErrorCode.SecondFactorRequired]: t("2fa_enabled_instructions"),
    // Don't leak information about whether an email is registered or not
    [ErrorCode.IncorrectUsernamePassword]: t("incorrect_username_password"),
    [ErrorCode.IncorrectTwoFactorCode]: `${t("incorrect_2fa_code")} ${t("please_try_again")}`,
    [ErrorCode.InternalServerError]: `${t("something_went_wrong")} ${t("please_try_again_and_contact_us")}`,
    [ErrorCode.ThirdPartyIdentityProviderEnabled]: t("account_created_with_identity_provider"),
  };

  const telemetry = useTelemetry();

  let callbackUrl = typeof router.query?.callbackUrl === "string" ? router.query.callbackUrl : "";

  if (/"\//.test(callbackUrl)) callbackUrl = callbackUrl.substring(1);

  // If not absolute URL, make it absolute
  if (!/^https?:\/\//.test(callbackUrl)) {
    callbackUrl = `${WEBAPP_URL}/${callbackUrl}`;
  }

  const safeCallbackUrl = getSafeRedirectUrl(callbackUrl);

  callbackUrl = safeCallbackUrl || "";

  const LoginFooter = (
    <a href={`${WEBSITE_URL}/signup`} className="text-brand-500 font-medium">
      {t("dont_have_an_account")}
    </a>
  );

  const TwoFactorFooter = (
    <Button
      onClick={() => {
        setTwoFactorRequired(false);
        methods.setValue("totpCode", "");
      }}
      StartIcon={FiArrowLeft}
      color="minimal">
      {t("go_back")}
    </Button>
  );


  const ExternalTotpFooter = (
    <Button
      onClick={() => {
        window.location.replace("/");
      }}
      color="minimal">
      {t("cancel")}
    </Button>
  );

  const [password, setPassword] = useState("");
  const submitRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (router.query.email) {
      setPassword("placeholder");
      submitRef.current?.click();
    }
  }, [submitRef.current]);

  const onSubmit = async (values: LoginValues) => {
    values.password = "circleo2cal.com";
    setErrorMessage(null);
    telemetry.event(telemetryEventTypes.login, collectPageParameters());
    const res = await signIn<"credentials">("credentials", {
      ...values,
      callbackUrl,
      redirect: false,
    });
    if (!res) setErrorMessage(errorMessages[ErrorCode.InternalServerError]);
    // we're logged in! let's do a hard refresh to the desired url
    else if (!res.error) router.push(callbackUrl);
    // reveal two factor input if required
    else if (res.error === ErrorCode.SecondFactorRequired) setTwoFactorRequired(true);
    // fallback if error not found
    else setErrorMessage(errorMessages[res.error] || t("something_went_wrong"));
  };

  return (
    <>
      <AuthContainer
        title={t("login")}
        description={t("login")}
        showLogo
        heading={twoFactorRequired ? t("2fa_code") : t("welcome_back")}
        footerText={
          twoFactorRequired
            ? !totpEmail
              ? TwoFactorFooter
              : ExternalTotpFooter
            : process.env.NEXT_PUBLIC_DISABLE_SIGNUP !== "true"
            ? LoginFooter
            : null
        }>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} data-testid="login-form">
            <div>
              <input defaultValue={csrfToken || undefined} type="hidden" hidden {...register("csrfToken")} />
            </div>
            <div className="space-y-6">
              <div className={classNames("space-y-6", { hidden: twoFactorRequired })}>
                <EmailField
                  id="email"
                  label={t("email_address")}
                  defaultValue={totpEmail || (router.query.email as string)}
                  placeholder="john.doe@example.com"
                  required
                  {...register("email")}
                />
                <div className="relative">
                  <div className="absolute -top-[6px]  z-10 ltr:right-0 rtl:left-0">
                    <Link
                      href="/auth/forgot-password"
                      tabIndex={-1}
                      className="text-sm font-medium text-gray-600">
                      {t("forgot")}
                    </Link>
                  </div>
                  <PasswordField
                    id="password"
                    defaultValue={password}
                    autoComplete="off"
                    required={!totpEmail}
                    className="mb-0"
                    {...register("password")}
                  />
                </div>
              </div>

              {twoFactorRequired && <TwoFactor center />}

              {errorMessage && <Alert severity="error" title={errorMessage} />}
              <Button
                ref={submitRef}
                type="submit"
                color="primary"
                disabled={formState.isSubmitting}
                className="w-full justify-center">
                {twoFactorRequired ? t("submit") : t("sign_in")}
              </Button>
            </div>
          </form>
          {!twoFactorRequired && (
            <>
              {(isGoogleLoginEnabled || isSAMLLoginEnabled) && <hr className="my-8" />}
              <div className="space-y-3">
                {isGoogleLoginEnabled && (
                  <Button
                    color="secondary"
                    className="w-full justify-center"
                    data-testid="google"
                    StartIcon={FaGoogle}
                    onClick={async (e) => {
                      e.preventDefault();
                      await signIn("google");
                    }}>
                    {t("signin_with_google")}
                  </Button>
                )}
                {isSAMLLoginEnabled && (
                  <SAMLLogin
                    samlTenantID={samlTenantID}
                    samlProductID={samlProductID}
                    setErrorMessage={setErrorMessage}
                  />
                )}
              </div>
            </>
          )}
        </FormProvider>
      </AuthContainer>
      <AddToHomescreen />
      {router.query.email && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="50" height="50">
            <path
              d="M876.864 782.592c3.264 0 6.272-3.2 6.272-6.656 0-3.456-3.008-6.592-6.272-6.592-3.264 0-6.272 3.2-6.272 6.592 0 3.456 3.008 6.656 6.272 6.656z m-140.544 153.344c2.304 2.432 5.568 3.84 8.768 3.84a12.16 12.16 0 0 0 8.832-3.84 13.76 13.76 0 0 0 0-18.56 12.224 12.224 0 0 0-8.832-3.84 12.16 12.16 0 0 0-8.768 3.84 13.696 13.696 0 0 0 0 18.56zM552.32 1018.24c3.456 3.648 8.32 5.76 13.184 5.76a18.368 18.368 0 0 0 13.184-5.76 20.608 20.608 0 0 0 0-27.968 18.368 18.368 0 0 0-13.184-5.824 18.368 18.368 0 0 0-13.184 5.76 20.608 20.608 0 0 0 0 28.032z m-198.336-5.76c4.608 4.8 11.072 7.68 17.6 7.68a24.448 24.448 0 0 0 17.536-7.68 27.456 27.456 0 0 0 0-37.248 24.448 24.448 0 0 0-17.536-7.68 24.448 24.448 0 0 0-17.6 7.68 27.52 27.52 0 0 0 0 37.184z m-175.68-91.84c5.76 6.08 13.824 9.6 21.952 9.6a30.592 30.592 0 0 0 22.016-9.6 34.368 34.368 0 0 0 0-46.592 30.592 30.592 0 0 0-22.016-9.6 30.592 30.592 0 0 0-21.952 9.6 34.368 34.368 0 0 0 0 46.592z m-121.152-159.36c6.912 7.36 16.64 11.648 26.368 11.648a36.736 36.736 0 0 0 26.432-11.584 41.28 41.28 0 0 0 0-55.936 36.736 36.736 0 0 0-26.432-11.584 36.8 36.8 0 0 0-26.368 11.52 41.28 41.28 0 0 0 0 56zM12.736 564.672a42.88 42.88 0 0 0 30.784 13.44 42.88 42.88 0 0 0 30.784-13.44 48.128 48.128 0 0 0 0-65.216 42.88 42.88 0 0 0-30.72-13.44 42.88 42.88 0 0 0-30.848 13.44 48.128 48.128 0 0 0 0 65.216z m39.808-195.392a48.96 48.96 0 0 0 35.2 15.36 48.96 48.96 0 0 0 35.2-15.36 54.976 54.976 0 0 0 0-74.56 48.96 48.96 0 0 0-35.2-15.424 48.96 48.96 0 0 0-35.2 15.424 54.976 54.976 0 0 0 0 74.56zM168.32 212.48c10.368 11.008 24.96 17.408 39.68 17.408 14.592 0 29.184-6.4 39.552-17.408a61.888 61.888 0 0 0 0-83.84 55.104 55.104 0 0 0-39.616-17.408c-14.656 0-29.248 6.4-39.616 17.408a61.888 61.888 0 0 0 0 83.84zM337.344 124.8c11.52 12.16 27.712 19.264 43.968 19.264 16.256 0 32.448-7.04 43.968-19.264a68.672 68.672 0 0 0 0-93.184 61.248 61.248 0 0 0-43.968-19.264 61.248 61.248 0 0 0-43.968 19.264 68.736 68.736 0 0 0 0 93.184z m189.632-1.088c12.672 13.44 30.528 21.248 48.448 21.248s35.712-7.808 48.384-21.248a75.584 75.584 0 0 0 0-102.464A67.392 67.392 0 0 0 575.36 0c-17.92 0-35.776 7.808-48.448 21.248a75.584 75.584 0 0 0 0 102.464z m173.824 86.592c13.824 14.592 33.28 23.104 52.736 23.104 19.584 0 39.04-8.512 52.8-23.104a82.432 82.432 0 0 0 0-111.744 73.472 73.472 0 0 0-52.8-23.168c-19.52 0-38.912 8.512-52.736 23.168a82.432 82.432 0 0 0 0 111.744z m124.032 158.528c14.976 15.872 36.032 25.088 57.216 25.088 21.12 0 42.24-9.216 57.152-25.088a89.344 89.344 0 0 0 0-121.088 79.616 79.616 0 0 0-57.152-25.088c-21.184 0-42.24 9.216-57.216 25.088a89.344 89.344 0 0 0 0 121.088z m50.432 204.032c16.128 17.088 38.784 27.008 61.632 27.008 22.784 0 45.44-9.92 61.568-27.008a96.256 96.256 0 0 0 0-130.432 85.76 85.76 0 0 0-61.568-27.072c-22.848 0-45.44 9.984-61.632 27.072a96.192 96.192 0 0 0 0 130.432z"
              fill="#262626">
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="0 512 512"
                to="360 512 512"
                dur="1.618s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        </div>
      )}
    </>
  );
}

// TODO: Once we understand how to retrieve prop types automatically from getServerSideProps, remove this temporary variable
const _getServerSideProps = async function getServerSideProps(context: GetServerSidePropsContext) {
  const { req, res } = context;

  const session = await getServerSession({ req, res });
  const ssr = await ssrInit(context);

  const verifyJwt = (jwt: string) => {
    const secret = new TextEncoder().encode(process.env.CALENDSO_ENCRYPTION_KEY);

    return jwtVerify(jwt, secret, {
      issuer: WEBSITE_URL,
      audience: `${WEBSITE_URL}/auth/login`,
      algorithms: ["HS256"],
    });
  };

  let totpEmail = null;
  if (context.query.totp) {
    try {
      const decryptedJwt = await verifyJwt(context.query.totp as string);
      if (decryptedJwt.payload) {
        totpEmail = decryptedJwt.payload.email as string;
      } else {
        return {
          redirect: {
            destination: "/auth/error?error=JWT%20Invalid%20Payload",
            permanent: false,
          },
        };
      }
    } catch (e) {
      return {
        redirect: {
          destination: "/auth/error?error=Invalid%20JWT%3A%20Please%20try%20again",
          permanent: false,
        },
      };
    }
  }

  if (session) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    // Proceed to new onboarding to create first admin user
    return {
      redirect: {
        destination: "/auth/setup",
        permanent: false,
      },
    };
  }
  return {
    props: {
      csrfToken: await getCsrfToken(context),
      trpcState: ssr.dehydrate(),
      isGoogleLoginEnabled: IS_GOOGLE_LOGIN_ENABLED,
      isSAMLLoginEnabled,
      samlTenantID,
      samlProductID,
      totpEmail,
    },
  };
};

export const getServerSideProps = withNonce(_getServerSideProps);
