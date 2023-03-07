const errorHandler = (error, req, res, next) => {
  console.error(error);
  const errStatus = error.statusCode || 500;
  const errMsg = error.message || 'Something went wrong';
  res.status(errStatus).json({
    success: false,
    status: errStatus,
    message: errMsg,
    stack: error.stack,
  });
};

module.exports = errorHandler;
