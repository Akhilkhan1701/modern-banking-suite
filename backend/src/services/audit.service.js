const auditModel = require("../models/audit.model");

async function writeAudit(req, { action, targetType, targetId, metadata = {} }) {
  try {
    await auditModel.create({
      actor: req.user?._id,
      action,
      targetType,
      targetId,
      metadata,
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    });
  } catch {
  }
}

module.exports = { writeAudit };
