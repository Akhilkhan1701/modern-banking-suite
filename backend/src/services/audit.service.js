/**
 * Audit Service
 * Handles the recording of system-wide audit logs for security and compliance.
 */
const auditModel = require("../models/audit.model");

/**
 * Records an audit entry. This operation is designed to be non-blocking.
 * @param {object} req - Express request object.
 * @param {object} params - Audit parameters.
 * @param {string} params.action - The action being performed (e.g., "LOGIN", "TRANSFER").
 * @param {string} params.targetType - The type of object being acted upon (e.g., "account", "user").
 * @param {string} params.targetId - The ID of the target object.
 * @param {object} params.metadata - Additional contextual information.
 */
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
    // Audit failures should not block the main application flow.
  }
}

module.exports = { writeAudit };
