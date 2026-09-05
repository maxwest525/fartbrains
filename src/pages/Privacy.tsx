import { SupportContact } from "@/components/legal/SupportContact";
import { LegalPage } from "@/components/legal/LegalPage";

/**
 * DRAFT privacy policy. Every factual claim here was written to match what the
 * code actually does as of this draft — if you change the product, change this.
 * Notably absent, deliberately: any claim that AI providers do not train on
 * customer data. That has not been verified for the production contract.
 */
const Privacy = () => (
  <LegalPage title="Privacy Policy" lastUpdated="September 2026">
    <p>
      Fartbrains is a private second brain. Everything you capture belongs to
      you. This page explains what we store, who it is shared with, and what you
      can do about it.
    </p>

    <h2>What we store</h2>
    <ul>
      <li>
        <strong>Your account:</strong> email address, and a password hash if you
        use one. We never store your password itself.
      </li>
      <li>
        <strong>Your content:</strong> notes, links, transcripts, summaries,
        tags, folders, reminders, tasks, references and AI conversations.
      </li>
      <li>
        <strong>Operational metadata:</strong> which AI operations ran, when,
        how large they were, and whether they succeeded. This never includes the
        content of those operations.
      </li>
      <li>
        <strong>Billing:</strong> your subscription status and a Stripe customer
        reference. Card details go to Stripe and never reach our servers.
      </li>
    </ul>

    <h2>Who can see your content</h2>
    <p>
      Nobody else, by default. Every account is one private brain. There are no
      team accounts, shared workspaces or shared folders. Database access rules
      scope every record to its owner.
    </p>
    <p>
      The one exception is a share link you create yourself. A share link exposes
      a single item, read-only, and only the sections you tick. It never exposes
      your account, your other items, your folders, your tags, your AI chats or
      your identity. You can revoke it at any time, and it stops working
      immediately.
    </p>
    <p>
      Staff access: as the operator, we can technically reach the database in
      order to run and repair the service. We access customer content only when
      necessary to fix a problem or when required by law.
    </p>

    <h2>Third parties we send data to</h2>
    <p>To make the product work, some content leaves our servers:</p>
    <ul>
      <li>
        <strong>AI providers</strong> receive the text you ask us to summarize,
        tag, research or answer questions about.
      </li>
      <li>
        <strong>Transcription providers</strong> receive audio you record or
        media you ask us to transcribe.
      </li>
      <li>
        <strong>Web pages you paste</strong> are fetched by us so we can extract
        their text.
      </li>
      <li>
        <strong>Stripe</strong> handles payments.
      </li>
      <li>
        <strong>Our email provider</strong> sends reminders and account emails.
      </li>
    </ul>
    <p>
      Each of these providers has its own terms and its own data practices. We
      have not independently verified whether any given provider uses submitted
      content to train models, and we do not claim otherwise. If that matters to
      you, do not put sensitive material into AI features.
    </p>

    <h2>Analytics</h2>
    <p>
      We record which features are used — for example that a capture happened —
      but never what was in them. Note bodies, titles, transcripts, search
      queries, URLs and email addresses are stripped before anything is
      recorded.
    </p>

    <h2>Your rights</h2>
    <ul>
      <li>
        <strong>Export:</strong> download everything, as JSON and as Markdown,
        from Settings, at any time, on any plan.
      </li>
      <li>
        <strong>Deletion:</strong> delete your account from Settings. This
        permanently removes your items, folders, tags, references, reminders, AI
        chats, instructions and share links. It cannot be undone.
      </li>
      <li>
        <strong>Correction and access:</strong> your content is directly
        editable in the app.
      </li>
    </ul>
    <p>
      Deleted items go to Trash first and are recoverable for 30 days, after
      which they are removed permanently. Backups may retain deleted data for a
      short additional period before rotating out.
    </p>

    <h2>Security</h2>
    <p>
      Data is transmitted over HTTPS and stored with our hosting provider.
      Access to your records is enforced at the database level. Share links use
      high-entropy tokens, and we store only a hash of each token, so the links
      cannot be reconstructed from our database.
    </p>
    <p>
      No service is perfectly secure. Please do not store material whose
      exposure would seriously harm you.
    </p>

    <h2>Children</h2>
    <p>Fartbrains is not intended for anyone under 13.</p>

    <h2>Changes</h2>
    <p>
      If this policy changes materially, we will say so in the app before the
      change takes effect.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about privacy, or a request about your data: <SupportContact />
    </p>
  </LegalPage>
);

export default Privacy;
