const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ═══════════════════════════════════════════════════════════
//  License System - Africa University Cafeteria
//  Master Secret (DO NOT SHARE)
// ═══════════════════════════════════════════════════════════

const LICENSE_SECRET = 'AUC-CAFETERIA-2026-MASTER-KEY-X9K4';
const LICENSE_FILE = process.env.LICENSE_PATH || path.join(__dirname, '..', '..', 'database', '.license');

/**
 * Generate a machine fingerprint based on hardware info
 */
function getMachineId() {
  const info = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || 'unknown',
  ].join('|');
  return crypto.createHash('sha256').update(info).digest('hex').substring(0, 16);
}

/**
 * Generate a valid license key for a given machine ID
 * Format: AUCS-XXXX-XXXX-XXXX
 */
function generateLicenseKey(machineId) {
  const data = `${LICENSE_SECRET}:${machineId}`;
  const hash = crypto.createHmac('sha256', LICENSE_SECRET).update(data).digest('hex');
  
  // Take parts of the hash and format as a readable key
  const part1 = hash.substring(0, 4).toUpperCase();
  const part2 = hash.substring(4, 8).toUpperCase();
  const part3 = hash.substring(8, 12).toUpperCase();
  
  return `AUCS-${part1}-${part2}-${part3}`;
}

/**
 * Validate a license key against the current machine
 */
function validateLicenseKey(inputKey) {
  const machineId = getMachineId();
  const validKey = generateLicenseKey(machineId);
  return inputKey.trim().toUpperCase() === validKey.toUpperCase();
}

/**
 * Check if the system is currently activated
 */
function isActivated() {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return false;
    
    const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    const machineId = getMachineId();
    
    // Verify the stored activation is for this machine
    const checkHash = crypto
      .createHmac('sha256', LICENSE_SECRET)
      .update(`${data.key}:${machineId}:activated`)
      .digest('hex');
    
    return data.hash === checkHash;
  } catch (err) {
    return false;
  }
}

/**
 * Activate the system with a license key
 */
function activate(key) {
  if (!validateLicenseKey(key)) {
    return { success: false, message: 'مفتاح التفعيل غير صحيح' };
  }
  
  const machineId = getMachineId();
  const activationHash = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(`${key.trim().toUpperCase()}:${machineId}:activated`)
    .digest('hex');
  
  const licenseData = {
    key: key.trim().toUpperCase(),
    machineId,
    hash: activationHash,
    activatedAt: new Date().toISOString(),
    hostname: os.hostname(),
  };
  
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenseData, null, 2), 'utf8');
  
  return { success: true, message: 'تم تفعيل النظام بنجاح!' };
}

/**
 * Get license status info
 */
function getLicenseStatus() {
  const machineId = getMachineId();
  const activated = isActivated();
  
  return {
    activated,
    machineId,
    hostname: os.hostname(),
  };
}

module.exports = {
  getMachineId,
  generateLicenseKey,
  validateLicenseKey,
  isActivated,
  activate,
  getLicenseStatus,
};
