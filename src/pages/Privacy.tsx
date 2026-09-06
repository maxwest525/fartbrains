import { LegalPage } from "@/components/legal/LegalPage";
import { SupportContact } from "@/components/legal/SupportContact";
import { Unset } from "@/components/legal/Unset";
import {
  LEGAL_ADDRESS,
  LEGAL_ENTITY,
  hasAddress,
  hasEntity,
} from "@/lib/config/legalEntity";

/**
 * DRAFT privacy policy — comprehensive, accurate to the code, not lawyer-reviewed.
 *
 * Every factual claim here was checked against what the product actually does,
 * which is the part a template cannot give you. Three things this policy says
 * that a generic one would not, because they are true of this product and
 * material to a reader:
 *
 *  - the transcript cache is shared across accounts, so a public video you
 *    transcribe may be served to someone else who transcribes the same video;
 *  - no analytics provider is connected, so the "we collect usage data"
 *    paragraph every policy has would be a claim to collect more than we do;
 *  - we do not assert that AI providers avoid training on submitted content,
 *    because that has not been verified for the production contract.
 *
 * If you change the product, change this. A policy that has drifted from the
 * code is worse than none: it is a written statement that is no longer true.
 */
const Privacy = () => (
  <LegalPage title="Privacy Policy" lastUpdated="September 2026">
    <p>
      Fartbrains is a private second brain. Everything you capture belongs to
      you. This page explains what we store, why we are allowed to store it, who
      else receives it, and what you can do about all of that.
    </p>

    <h2>Who is responsible for your data</h2>
    <p>
      The data controller for the personal data described here is{" "}
      {hasEntity() ? (
        <strong>{LEGAL_ENTITY}</strong>
      ) : (
        <Unset>the operator of Fartbrains — a registered legal entity has not been published yet</Unset>
      )}
      {hasAddress() ? <>, {LEGAL_ADDRESS}</> : null}. Contact:{" "}
      <SupportContact />
    </p>
    <p>
      Fartbrains is in beta. Features, providers and this policy are still
      changing, and we will tell you in the app before a material change takes
      effect.
    </p>

    <h2>What we store, and why we are allowed to</h2>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Why</th>
          <th>Legal basis (UK/EU)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Account:</strong> email address, password hash if you set
            one. We never store the password itself.
          </td>
          <td>To give you an account and let you sign in.</td>
          <td>Performance of our contract with you.</td>
        </tr>
        <tr>
          <td>
            <strong>Your content:</strong> notes, links, transcripts, summaries,
            titles, tags, folders, reminders, tasks, references, AI
            conversations, unsaved drafts.
          </td>
          <td>It is the product. We store it so you can get it back.</td>
          <td>Performance of our contract with you.</td>
        </tr>
        <tr>
          <td>
            <strong>Operational metadata:</strong> which AI operations ran, when,
            how large they were, whether they succeeded, and what they cost.
          </td>
          <td>
            To enforce plan allowances, prevent one account exhausting the
            provider budget for everyone, and bill correctly.
          </td>
          <td>
            Our legitimate interest in running a service that is not trivially
            abusable, and performance of our contract.
          </td>
        </tr>
        <tr>
          <td>
            <strong>Billing:</strong> subscription status, period dates, and a
            Stripe customer reference. Card details go to Stripe and never reach
            our servers.
          </td>
          <td>To take payment and know what you are entitled to.</td>
          <td>Performance of our contract, and our legal obligation to keep financial records.</td>
        </tr>
        <tr>
          <td>
            <strong>Push subscriptions:</strong> the endpoint and keys your
            browser issues, if you turn notifications on.
          </td>
          <td>To deliver reminders you asked for.</td>
          <td>Your consent, withdrawable by turning notifications off.</td>
        </tr>
      </tbody>
    </table>
    <p>
      Where we rely on legitimate interests, you can object — see{" "}
      <a href="#rights">your rights</a> below.
    </p>

    <h2>Who can see your content</h2>
    <p>
      Nobody else, by default. Every account is one private brain. There are no
      team accounts, shared workspaces or shared folders. Database access rules
      scope every record to its owner, and are enforced by the database itself
      rather than by the app asking nicely.
    </p>
    <p>
      <strong>Share links.</strong> The one exception is a link you create
      yourself. It exposes a single item, read-only, and only the sections you
      tick. It never exposes your account, your other items, your folders, your
      tags, your AI chats or your identity. Anyone holding the link can open it
      without an account, so treat it as public. You can revoke it at any time
      and it stops working immediately; moving the item to Trash also stops it.
    </p>
    <p>
      <strong>Staff access.</strong> As the operator we can technically reach
      the database in order to run and repair the service. We access customer
      content only when necessary to fix a problem, or when required by law.
    </p>

    <h2>The shared transcript cache</h2>
    <p>
      Transcribing a video is the most expensive thing this product does, so
      transcripts of <em>public</em> media — a YouTube video, an Instagram reel
      — are cached under the platform's own ID for that item, not under your
      account. If someone else later saves the same public video, they are
      served the cached transcript rather than paying to transcribe it again.
    </p>
    <p>
      This means a transcript you generate from a public video may be shown to
      another Fartbrains user who saves that same public video. It contains only
      what the video itself says, which that person could have transcribed
      themselves. <strong>Voice notes and anything you record or upload are
      never cached this way</strong> — they are private to your account, and the
      code is tested to keep it that way.
    </p>

    <h2>Who we send data to</h2>
    <p>
      To make the product work, some content leaves our servers. These are all
      the processors that receive it:
    </p>
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>What they receive</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Supabase (hosting, database, authentication)</td>
          <td>Everything we store. They are our infrastructure.</td>
        </tr>
        <tr>
          <td>Lovable AI Gateway</td>
          <td>
            Text you ask us to summarize, tag, research, turn into a prompt, or
            answer questions about — and audio for transcription, by default.
          </td>
        </tr>
        <tr>
          <td>ElevenLabs</td>
          <td>Audio for transcription, when configured as the speech provider.</td>
        </tr>
        <tr>
          <td>Firecrawl</td>
          <td>URLs you save, so their page text can be extracted, and research queries.</td>
        </tr>
        <tr>
          <td>Apify</td>
          <td>Instagram URLs you save, to retrieve the post and its media.</td>
        </tr>
        <tr>
          <td>Stripe</td>
          <td>Your email and payment details, to take payment. We never see the card.</td>
        </tr>
        <tr>
          <td>Your browser's push service (Google, Mozilla, Apple)</td>
          <td>Reminder notifications, if you enable them.</td>
        </tr>
      </tbody>
    </table>
    <p>
      <strong>We do not claim these providers avoid training on what we send
      them.</strong> We have not independently verified that for any of them,
      and a policy that asserted it without checking would be telling you
      something we do not know. If it matters to you, do not put sensitive
      material through AI features — capture and search work without them.
    </p>
    <p>
      We do not sell your personal information, and we do not share it for
      cross-context behavioural advertising. There is no advertising in this
      product and no ad network receives anything.
    </p>

    <h2>Where your data is held</h2>
    <p>
      Our infrastructure and these providers operate in the United States and
      elsewhere, so if you are in the UK or EEA your data is transferred outside
      it. Where that happens we rely on the providers' standard contractual
      clauses or an equivalent transfer mechanism in their terms.
    </p>

    <h2>What is stored on your own device</h2>
    <p>
      We do not use advertising or tracking cookies. The app stores a few things
      in your browser, all of them necessary for it to work:
    </p>
    <ul>
      <li>your sign-in session, so you are not logged out on every reload;</li>
      <li>
        your app-lock passcode as a salted, slowly-derived hash — never the
        passcode itself, and it never leaves your device;
      </li>
      <li>unsent drafts and small interface preferences;</li>
      <li>
        a diagnostic log of errors that occurred on your device, stripped of note
        content, kept so you can read or copy it from Settings. It is not sent
        anywhere.
      </li>
    </ul>
    <p>Clearing your browser storage removes all of it.</p>

    <h2>Analytics</h2>
    <p>
      <strong>No analytics provider is connected.</strong> The app contains the
      plumbing for product analytics — which is built to send event names and a
      short allowlist of properties, never note bodies, titles, transcripts,
      search queries, URLs or email addresses — but nothing is wired to it, so
      no usage data is collected or sent to anyone. If that changes we will say
      so here and in the app first.
    </p>

    <h2 id="rights">Your rights</h2>
    <p>
      If you are in the UK or EEA you have the rights below under the UK GDPR
      and GDPR. We extend the practical ones to everyone regardless of where you
      live, because they are just how the product works.
    </p>
    <ul>
      <li>
        <strong>Access and portability.</strong> Download everything, as JSON
        and as Markdown, from Settings, at any time, on any plan. No request
        needed and no waiting.
      </li>
      <li>
        <strong>Rectification.</strong> Your content is directly editable in the
        app. For account data we hold that you cannot edit, ask us.
      </li>
      <li>
        <strong>Erasure.</strong> Delete your account from Settings. This
        permanently removes your items, folders, tags, references, reminders, AI
        chats, instructions, drafts, share links, push subscriptions, usage
        records and subscription record, and then the login itself. It cannot be
        undone.
      </li>
      <li>
        <strong>Restriction and objection.</strong> Ask us to pause processing,
        or object to processing we base on legitimate interests.
      </li>
      <li>
        <strong>Withdraw consent.</strong> Turn off push notifications at any
        time. Withdrawing consent does not affect processing already carried out.
      </li>
      <li>
        <strong>Complain.</strong> You can complain to your data protection
        authority. In the UK that is the Information Commissioner's Office
        (ico.org.uk); in the EEA it is the authority in your country. We would
        rather you told us first so we can fix it.
      </li>
    </ul>
    <p>
      We do not make decisions about you by automated means that produce legal
      or similarly significant effects.
    </p>

    <h2>If you are in California</h2>
    <p>
      In the last twelve months we have collected the categories described
      above: identifiers (email), commercial information (subscription status),
      internet activity limited to operational metadata about AI usage, and the
      contents of what you choose to store. We collect it for the purposes given
      in the table, from you directly.
    </p>
    <p>
      <strong>We have not sold personal information and have not shared it for
      cross-context behavioural advertising</strong>, including for any consumer
      we knew to be under 16. You have the right to know, delete, and correct,
      and not to be discriminated against for exercising those rights. Deletion
      and access are self-service in Settings; for anything else, contact us.
    </p>

    <h2>How long we keep it</h2>
    <ul>
      <li>
        <strong>While your account exists:</strong> your content is kept until
        you delete it or the account.
      </li>
      <li>
        <strong>Trash:</strong> deleted items are recoverable for 30 days, then
        permanently removed by a scheduled job.
      </li>
      <li>
        <strong>Account deletion:</strong> processed immediately, not queued.
      </li>
      <li>
        <strong>Backups:</strong> our host's backups may retain deleted data for
        a short additional period before rotating out.
      </li>
      <li>
        <strong>Billing records:</strong> retained as long as tax and accounting
        law requires, with the person detached from them where possible.
      </li>
    </ul>

    <h2>Security</h2>
    <p>
      Data is transmitted over HTTPS and stored with our hosting provider.
      Access to your records is enforced at the database level, so a bug in the
      app cannot serve one customer another's rows. Share links use 256-bit
      tokens and we store only a hash of each, so working links cannot be
      reconstructed from our database. The app-lock passcode is a convenience
      lock on this device, not encryption of your data.
    </p>
    <p>
      No service is perfectly secure, and this one is in beta. Please do not
      store material whose exposure would seriously harm you.
    </p>

    <h2>Children</h2>
    <p>
      Fartbrains is not intended for children. You must be at least 16 in the
      UK and EEA, or at least 13 elsewhere. We do not knowingly collect data
      from anyone younger; if you believe we have, tell us and we will delete
      it.
    </p>

    <h2>Changes</h2>
    <p>
      If this policy changes materially, we will say so in the app before the
      change takes effect, and update the date at the top.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about privacy, or a request about your data: <SupportContact />
    </p>
  </LegalPage>
);

export default Privacy;
