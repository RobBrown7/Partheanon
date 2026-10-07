// Run before reading or saving account-specific data. Host account selection is
// authoritative; a saved setup record cannot grant access to another account.
export function accountMismatch(reported, expected) {
  const actual = typeof reported === "string" ? reported.trim() : "";
  const wanted = expected.trim();
  if (actual && actual.toLowerCase() === wanted.toLowerCase()) return null;
  return {
    status: "account_mismatch",
    expectedAccount: wanted,
    reportedAccount: actual || null,
    message: `The Site is receiving ${actual || "an unknown account"}, while this source needs ${wanted}. This is an account selection mismatch, not a failed connection. Review Site account selection in this account’s setup. The current integration selects one account per service; adding accounts to ChatGPT does not enable simultaneous reads. No data was saved for this source.`,
  };
}
