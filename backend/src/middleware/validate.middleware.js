function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      req.body = parsed.body ?? req.body;
      req.params = parsed.params ?? req.params;
      req.query = parsed.query ?? req.query;
      return next();
    } catch (err) {
      const first = err?.issues?.[0];
      return res.status(400).json({
        message: first?.message || "Validation failed",
      });
    }
  };
}

module.exports = { validate };

