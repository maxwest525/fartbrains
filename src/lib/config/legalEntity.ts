/**
 * The facts a privacy policy and terms of service cannot be written without.
 *
 * A privacy policy has to name its data controller — that is not a stylistic
 * choice, it is Article 13(1)(a) of the GDPR — and terms of service without a
 * governing law leave every dispute to argue about where it is heard before it
 * argues about anything else. Neither can be invented here.
 *
 * So they are configuration. Where a value is missing the pages say so in
 * place, rather than printing a bracket or, worse, quietly omitting a section
 * that is supposed to be there.
 */

const read = (v: string | undefined): string => (v ?? "").trim();

/** Registered company or sole-trader name, e.g. "Fartbrains Ltd". */
export const LEGAL_ENTITY = read(import.meta.env.VITE_LEGAL_ENTITY);

/** Registered address, one line. */
export const LEGAL_ADDRESS = read(import.meta.env.VITE_LEGAL_ADDRESS);

/** Governing law and courts, e.g. "the State of Delaware, USA". */
export const GOVERNING_LAW = read(import.meta.env.VITE_GOVERNING_LAW);

export const hasEntity = (): boolean => LEGAL_ENTITY.length > 0;
export const hasAddress = (): boolean => LEGAL_ADDRESS.length > 0;
export const hasGoverningLaw = (): boolean => GOVERNING_LAW.length > 0;

/** True when every legally required identity field is filled in. */
export const legalIdentityComplete = (): boolean =>
  hasEntity() && hasAddress() && hasGoverningLaw();
