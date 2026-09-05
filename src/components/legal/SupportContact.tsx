import { SUPPORT_EMAIL, hasSupportEmail } from "@/lib/config/supportContact";

/**
 * The contact line on the legal pages. Renders a real address when one is
 * configured, and an honest sentence when one is not — never a placeholder
 * standing in for it.
 */
export const SupportContact = ({ suffix }: { suffix?: string }) => {
  if (!hasSupportEmail()) {
    return (
      <>
        A published contact address is not set up yet. Until it is, reach us
        through the account you signed up with.
        {suffix ? ` ${suffix}` : ""}
      </>
    );
  }
  return (
    <>
      <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary">
        {SUPPORT_EMAIL}
      </a>
      {suffix ? ` ${suffix}` : ""}
    </>
  );
};
