export const DOCS = ["doc/**", "docs/**", "**/*.md", "LICENSE", ".github/ISSUE_TEMPLATE/**"].map(
  (pattern) => `:(exclude,glob)${pattern}`,
);
