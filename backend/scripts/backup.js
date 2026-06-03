/**
 * MongoDB Backup Script for BrainBytes
 *
 * Usage:
 *   node scripts/backup.js                # Full backup
 *   node scripts/backup.js --collection messages  # Backup specific collection
 *   node scripts/backup.js --output /path/to/backups  # Custom output directory
 *
 * Requires mongodump to be installed on the system.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/brainbytes';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '10', 10);

// Parse command line arguments
const args = process.argv.slice(2);
const customOutput = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
const collectionOnly = args.includes('--collection')
  ? args[args.indexOf('--collection') + 1]
  : null;

function parseMongoUri(uri) {
  // Parse mongodb://host:port/database or mongodb://user:pass@host:port/database
  const match = uri.match(/mongodb:\/\/(?:[^@]+@)?([^\/]+)\/([^?]+)/);
  if (!match) {
    throw new Error(`Cannot parse MongoDB URI: ${uri}`);
  }
  return {
    host: match[1],
    database: match[2].split('?')[0].trim(),
  };
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = customOutput || path.join(BACKUP_DIR, `backup-${timestamp}`);

  // Ensure backup directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const { host, database } = parseMongoUri(MONGO_URI);

  console.log('========================================');
  console.log('  BrainBytes Database Backup');
  console.log('========================================');
  console.log(`  Database: ${database}`);
  console.log(`  Host: ${host}`);
  console.log(`  Output: ${outputDir}`);
  if (collectionOnly) console.log(`  Collection: ${collectionOnly}`);
  console.log('----------------------------------------');

  try {
    // Build mongodump command
    let cmd = `mongodump --host ${host} --db ${database} --out "${outputDir}"`;

    if (collectionOnly) {
      cmd += ` --collection ${collectionOnly}`;
    }

    console.log(`  Running: mongodump...`);
    execSync(cmd, { stdio: 'inherit', timeout: 300000 }); // 5 min timeout

    // Get backup size
    const size = getDirSize(outputDir);
    const fileCount = countFiles(outputDir);

    console.log('----------------------------------------');
    console.log('  ✅ Backup completed successfully!');
    console.log(`  📁 Location: ${outputDir}`);
    console.log(`  📦 Size: ${formatSize(size)}`);
    console.log(`  📄 Files: ${fileCount}`);
    console.log('========================================');

    // Rotate old backups
    if (!customOutput && !collectionOnly) {
      rotateBackups();
    }

    return outputDir;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

function getDirSize(dir) {
  let size = 0;
  try {
    const files = fs.readdirSync(dir, { recursive: true });
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        size += fs.statSync(filePath).size;
      } catch {}
    }
  } catch {}
  return size;
}

function countFiles(dir) {
  let count = 0;
  try {
    const files = fs.readdirSync(dir, { recursive: true });
    count = files.length;
  } catch {}
  return count;
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

function rotateBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => name.startsWith('backup-'))
      .map((name) => ({
        name,
        path: path.join(BACKUP_DIR, name),
        time: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time); // newest first

    if (backups.length > MAX_BACKUPS) {
      const toRemove = backups.slice(MAX_BACKUPS);
      console.log(`\n  Rotating old backups (max ${MAX_BACKUPS}):`);
      for (const backup of toRemove) {
        fs.rmSync(backup.path, { recursive: true, force: true });
        console.log(`    🗑️  Removed: ${backup.name}`);
      }
    }
  } catch (error) {
    console.warn('  ⚠️  Backup rotation warning:', error.message);
  }
}

// Run backup
createBackup();
