function notFoundHandler(_req, res) {
  return res.status(404).json({ error: 'No encontrado' });
}

function errorHandler(err, _req, res, _next) {
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
