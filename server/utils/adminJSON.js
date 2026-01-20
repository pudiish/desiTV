/**
 * JSON-based Admin Management
 * No MongoDB required - admins stored in admins.json
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const ADMINS_FILE = path.join(__dirname, '../data/admins.json');

/**
 * Read admins from JSON file
 */
function readAdmins() {
  try {
    if (!fs.existsSync(ADMINS_FILE)) {
      // Create default admin file
      const defaultData = {
        admins: [],
        note: "Admin accounts for DesiTV"
      };
      fs.writeFileSync(ADMINS_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const data = fs.readFileSync(ADMINS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[AdminJSON] Error reading admins:', err.message);
    return { admins: [] };
  }
}

/**
 * Write admins to JSON file
 */
function writeAdmins(data) {
  try {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('[AdminJSON] Error writing admins:', err.message);
    return false;
  }
}

/**
 * Find admin by username
 */
function findOne(query) {
  const data = readAdmins();
  const admin = data.admins.find(a => 
    a.username.toLowerCase() === query.username?.toLowerCase()
  );
  
  if (!admin) return null;
  
  // Return with MongoDB-like _id for compatibility
  return {
    ...admin,
    _id: admin.id,
    save: async function() {
      // Update admin in JSON
      const freshData = readAdmins();
      const index = freshData.admins.findIndex(a => a.id === this.id);
      if (index !== -1) {
        freshData.admins[index] = {
          id: this.id,
          username: this.username,
          passwordHash: this.passwordHash,
          role: this.role,
          createdAt: this.createdAt,
          lastLogin: this.lastLogin
        };
        writeAdmins(freshData);
      }
    }
  };
}

/**
 * Find admin by ID
 */
function findById(id) {
  const data = readAdmins();
  const admin = data.admins.find(a => a.id === id);
  
  if (!admin) return null;
  
  return {
    ...admin,
    _id: admin.id
  };
}

/**
 * Count admins
 */
function countDocuments() {
  const data = readAdmins();
  return data.admins.length;
}

/**
 * Create new admin
 */
async function create(adminData) {
  const data = readAdmins();
  
  // Check if username exists
  if (data.admins.some(a => a.username.toLowerCase() === adminData.username.toLowerCase())) {
    throw new Error('Username already exists');
  }
  
  const newAdmin = {
    id: `admin-${Date.now()}`,
    username: adminData.username.toLowerCase(),
    passwordHash: adminData.passwordHash,
    role: adminData.role || 'admin',
    createdAt: adminData.createdAt || new Date().toISOString(),
    lastLogin: null
  };
  
  data.admins.push(newAdmin);
  writeAdmins(data);
  
  return {
    ...newAdmin,
    _id: newAdmin.id
  };
}

// Export MongoDB-like interface
module.exports = {
  findOne: async (query) => findOne(query),
  findById: async (id) => findById(id),
  countDocuments: async () => countDocuments(),
  create: async (data) => create(data)
};
