/**
 * Marks a fact the pages need and do not have.
 *
 * Deliberately conspicuous. A missing controller name or governing law is not
 * a typo to be smoothed over — it is a section of the document that does not
 * work yet, and the reader is better served by being told than by a sentence
 * that reads fine and says nothing.
 */
export const Unset = ({ children }: { children: React.ReactNode }) => (
  <mark className="bg-[hsl(38_92%_50%/0.25)] px-1 rounded not-italic">
    {children}
  </mark>
);
