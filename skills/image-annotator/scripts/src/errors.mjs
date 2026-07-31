export class UsageError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "UsageError";
  }
}
