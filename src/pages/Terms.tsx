import { SupportContact } from "@/components/legal/SupportContact";
import { LegalPage } from "@/components/legal/LegalPage";

/** DRAFT terms of service. Placeholder text pending legal review. */
const Terms = () => (
  <LegalPage title="Terms of Service" lastUpdated="September 2026">
    <p>
      These terms cover your use of Fartbrains. By creating an account you agree
      to them.
    </p>

    <h2>Your account</h2>
    <p>
      You need an account to use Fartbrains, you must give a working email
      address, and you are responsible for keeping your credentials safe. One
      account is one person's private brain — accounts are not for sharing
      between people.
    </p>
    <p>You must be at least 13 years old.</p>

    <h2>Your content stays yours</h2>
    <p>
      You own everything you put into Fartbrains. We claim no ownership of it.
      You grant us only the permission needed to run the service for you: to
      store your content, process it, and pass the parts you ask us to process
      to the third-party providers listed in the Privacy Policy.
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
      will tell you first and give you a chance to export your data.
    </p>

    <h2>Plans, billing and cancellation</h2>
    <p>
      Some features require a paid subscription. Subscriptions renew
      automatically until cancelled, and are billed through Stripe.
    </p>
    <ul>
      <li>You can cancel at any time from Billing in Settings.</li>
      <li>
        Cancelling stops future charges and keeps your access until the end of
        the period you have already paid for.
      </li>
      <li>
        Cancelling never deletes your content. Reading, searching, exporting and
        deleting your account remain available on the free plan, forever.
      </li>
      <li>
        We do not automatically refund partial periods. If something has gone
        genuinely wrong, contact us and we will sort it out.
      </li>
      <li>
        If we change prices, existing subscribers get notice before the change
        applies to them.
      </li>
    </ul>

    <h2>Usage limits</h2>
    <p>
      AI features cost real money to run, so each plan includes an allowance and
      rate limits. Hitting a limit restricts new AI actions; it never restricts
      access to what you have already captured. Limits may be adjusted, with
      notice for paid plans.
    </p>

    <h2>Sharing an item</h2>
    <p>
      If you create a share link, you are choosing to publish that item to
      anyone holding the link. You are responsible for what you share and who you
      send it to. You can revoke a link at any time.
    </p>

    <h2>Availability</h2>
    <p>
      Fartbrains is provided as-is, with no uptime guarantee. We may change,
      suspend or discontinue features. If we discontinue the service, we will
      give reasonable notice and time to export your data.
    </p>
    <p>
      Some features depend on third parties — AI providers, transcription
      services, and public websites. Those can change or break outside our
      control.
    </p>

    <h2>Liability</h2>
    <p>
      To the extent the law allows, we are not liable for indirect or
      consequential losses, or for lost data. Keep your own backups of anything
      you cannot afford to lose — export is always available.
    </p>
    <p>
      Where liability cannot be excluded, it is limited to what you paid us in
      the 12 months before the claim.
    </p>

    <h2>Ending your account</h2>
    <p>
      You can delete your account at any time from Settings. Deletion is
      permanent. Export first if you want a copy.
    </p>

    <h2>Changes to these terms</h2>
    <p>
      If these terms change materially, we will say so in the app before the
      change takes effect. Continuing to use Fartbrains after that means you
      accept the new terms.
    </p>

    <h2>Contact</h2>
    <p>
      <SupportContact suffix="The legal entity and registered address are not published yet." />
    </p>
  </LegalPage>
);

export default Terms;
