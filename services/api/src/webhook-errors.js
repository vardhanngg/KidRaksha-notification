// Invalid JSON is a permanent client error; processing failures must be retried by the provider.
export function webhookFailureStatus(error) {
  return error instanceof SyntaxError ? 400 : 500;
}
