/** Operational error that maps directly to an HTTP response. */
export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details; // [{ field, message }]
  }
}
