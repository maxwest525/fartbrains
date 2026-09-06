import { LegalPage } from "@/components/legal/LegalPage";
import { SupportContact } from "@/components/legal/SupportContact";
import { Unset } from "@/components/legal/Unset";
import {
  GOVERNING_LAW,
  LEGAL_ADDRESS,
  LEGAL_ENTITY,
  hasAddress,
  hasEntity,
  hasGoverningLaw,
} from "@/lib/config/legalEntity";

/**
 * DRAFT terms of service — comprehensive, not lawyer-reviewed.
 *
 * Three things a template would have got wrong here, and which matter:
 *
 *  - A blanket "no refunds" is unenforceable against UK and EEA consumers, who
 *    have a statutory 14-day right to cancel a distance contract. Waiving it
 *    requires the customer's express request and acknowledgement, so the
 *    section says how that works rather than pretending the right is not there.
 *  - A liability cap cannot exclude death, personal injury, fraud, or a
 *    consumer's non-excludable statutory rights. Caps that try to are read down
 *    or struck out whole, so the carve-out is explicit.
 *  - Auto-renewal has to be disclosed with its frequency, price and the
 *    cancellation route, plainly, before purchase — California's Automatic
 *    Renewal Law and the FTC's negative-option rule both turn on that.
 */
const Terms = () => (
  <LegalPage title="Terms of Service" lastUpdated="September 2026">
    <p>
      These terms are the agreement between you and{" "}
      {hasEntity() ? (
        <strong>{LEGAL_ENTITY}</strong>
      ) : (
        <Unset>the operator of Fartbrains — a registered legal entity has not been published yet</Unset>
      )}
      {hasAddress() ? <>, {LEGAL_ADDRESS},</> : null} covering your use of
      Fartbrains. By creating an account you agree to them.
    </p>
    <p>
      <strong>Fartbrains is in beta.</strong> It is a working product and we use
      it ourselves, but features change, break and disappear more than they
      would in a finished one. Export is always available; please use it.
    </p>

    <h2>Your account</h2>
    <p>
      You need an account, you must give a working email address, and you are
      responsible for keeping your credentials safe. One account is one person's
      private brain — accounts are not for sharing between people.
    </p>
    <p>
      You must be at least 16 if you are in the UK or EEA, or at least 13
      elsewhere.
    </p>

    <h2>Your content stays yours</h2>
    <p>
      You own everything you put into Fartbrains. We claim no ownership of it
      and we do not use it to train anything of our own.
    </p>
    <p>
      You grant us only the permission needed to run the service for you: to
      store your content, process it, and pass the parts you ask us to process
      to the providers named in the Privacy Policy. That permission ends when
      you delete the content or your account.
    </p>
    <p>
      You are responsible for having the right to store what you store —
      including material you capture from elsewhere.
    </p>

    <h2>Acceptable use</h2>
    <p>Do not use Fartbrains to:</p>
    <ul>
      <li>break the law, or store material that is illegal to possess;</li>
      <li>infringe someone else's rights;</li>
      <li>
        attack, overload, probe or reverse-engineer the service, or work around
        its usage limits;
      </li>
      <li>resell the service or run it on someone else's behalf as a product.</li>
    </ul>
    <p>
      We may suspend an account that is doing these things. Where we can, we
      will tell you first and give you a chance to export your data. Where we
      cannot — because the conduct is causing harm now — we will tell you as
      soon as we reasonably can.
    </p>

    <h2>AI features</h2>
    <p>
      Summaries, tags, answers, research briefs and generated prompts are
      produced by AI models. They get things wrong, and they will sometimes
      state something confidently that is not true.
    </p>
    <p>
      Do not rely on them as professional advice — legal, medical, financial or
      otherwise — and check anything that matters against the source. You remain
      responsible for what you do with the output.
    </p>

    <h2>Plans, billing and cancellation</h2>
    <p>
      Some features require a paid subscription. Capture, search, reading and
      export do not.
    </p>
    <ul>
      <li>
        <strong>Automatic renewal.</strong> A subscription renews automatically
        at the end of each billing period, at the price shown at checkout,
        charged to your payment method, until you cancel. The period and price
        are displayed before you pay and in your receipt.
      </li>
      <li>
        <strong>Cancelling.</strong> Cancel any time from Billing in Settings —
        no email required, no retention call. Cancelling stops future charges
        and keeps your access until the end of the period you have already paid
        for.
      </li>
      <li>
        <strong>Cancelling never deletes your content.</strong> Reading,
        searching, exporting and deleting your account remain available on the
        free plan, forever.
      </li>
      <li>
        <strong>Failed payments.</strong> If a payment fails we will retry and
        tell you. Your paid features keep working while that is happening; they
        stop if it is not resolved.
      </li>
      <li>
        <strong>Price changes.</strong> Existing subscribers get notice before a
        change applies to them, and can cancel before it takes effect.
      </li>
      <li>
        <strong>Refunds.</strong> Outside the statutory rights below, we do not
        automatically refund partial periods. If something has genuinely gone
        wrong, contact us and we will sort it out.
      </li>
    </ul>

    <h3>If you are a consumer in the UK or EEA</h3>
    <p>
      You have a statutory right to cancel a distance contract within 14 days
      without giving a reason. Because a subscription gives you access
      immediately, by subscribing you expressly request that we begin supplying
      it during that period and acknowledge that you lose the right to cancel
      once it has been fully performed. If you cancel within 14 days before that
      point, you pay only for what you have used, and we refund the rest.
    </p>
    <p>
      Nothing in these terms affects your non-excludable statutory rights,
      including your rights in respect of digital content that is faulty or not
      as described.
    </p>

    <h2>Usage limits</h2>
    <p>
      AI features cost real money to run, so each plan includes an allowance,
      and per-minute and per-hour rate limits. Expensive operations such as
      transcription and deep research count for more than a cheap one. Hitting a
      limit restricts new AI actions; it never restricts access to what you have
      already captured. Limits may be adjusted, with notice for paid plans.
    </p>

    <h2>Sharing an item</h2>
    <p>
      If you create a share link, you are choosing to publish that item to
      anyone holding the link — no account needed. You are responsible for what
      you share and who you send it to. You can revoke a link at any time, and
      moving the item to Trash also stops it working.
    </p>
    <p>
      If you believe something shared through Fartbrains infringes your rights,
      contact us with enough detail to identify it and we will act on it.
    </p>

    <h2>Availability</h2>
    <p>
      Fartbrains is provided as-is and as-available, with no uptime guarantee.
      We may change, suspend or discontinue features. If we discontinue the
      service we will give reasonable notice and time to export your data.
    </p>
    <p>
      Some features depend on third parties — AI providers, transcription
      services, and public websites. Those can change or break outside our
      control.
    </p>

    <h2>Liability</h2>
    <p>
      <strong>Nothing in these terms limits or excludes liability for death or
      personal injury caused by negligence, for fraud or fraudulent
      misrepresentation, or for anything else that cannot lawfully be limited —
      including a consumer's non-excludable statutory rights.</strong>
    </p>
    <p>
      Subject to that: to the extent the law allows, we are not liable for
      indirect or consequential losses, loss of profit, or loss of data. Keep
      your own backups of anything you cannot afford to lose — export is always
      available, on every plan.
    </p>
    <p>
      Where liability can be limited, it is limited to the greater of what you
      paid us in the 12 months before the claim, or £50.
    </p>

    <h2>Ending your account</h2>
    <p>
      You can delete your account at any time from Settings. Deletion is
      permanent and immediate. Export first if you want a copy.
    </p>
    <p>
      We may end your account for a serious or repeated breach of these terms,
      or if we discontinue the service. Except where the breach makes it
      impossible, we will give you notice and a chance to export.
    </p>

    <h2>Changes to these terms</h2>
    <p>
      If these terms change materially, we will say so in the app before the
      change takes effect. Continuing to use Fartbrains after that means you
      accept the new terms. If you do not, you can cancel and export.
    </p>

    <h2>Governing law and disputes</h2>
    <p>
      {hasGoverningLaw() ? (
        <>
          These terms are governed by the laws of <strong>{GOVERNING_LAW}</strong>,
          and disputes will be heard by its courts.
        </>
      ) : (
        <Unset>
          A governing law and jurisdiction have not been published yet. Until
          they are, this section is incomplete.
        </Unset>
      )}{" "}
      If you are a consumer, this does not deprive you of the protection of the
      mandatory laws of the country you live in, or of your right to bring
      proceedings there.
    </p>
    <p>
      Please contact us before starting a formal dispute. Most things are a
      misunderstanding and are faster to fix directly.
    </p>

    <h2>General</h2>
    <ul>
      <li>
        If any part of these terms is unenforceable, the rest continues to
        apply.
      </li>
      <li>
        Not enforcing something once does not mean giving up the right to
        enforce it later.
      </li>
      <li>
        You may not transfer your rights under these terms. We may transfer ours
        if the service changes hands, and will tell you if that happens.
      </li>
      <li>
        These terms and the Privacy Policy are the whole agreement between us
        about Fartbrains.
      </li>
    </ul>

    <h2>Contact</h2>
    <p>
      <SupportContact />
    </p>
  </LegalPage>
);

export default Terms;
