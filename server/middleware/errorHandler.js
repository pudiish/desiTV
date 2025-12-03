module.exports = function errorHandler (err, req, res, next) {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  const status = err && err.status ? err.status : 500;
  res.status(status).json({ message: err && err.message ? err.message : 'Server error' });
}
