/**
 * Extends the Error class to add `status` and `data` as an additional fields
 */
class ApiError extends Error {
  constructor(message = 'Internal Server Error', statusCode = 500, data) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.data = data;
    // ensure stack trace is captured
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  ApiError,
};
