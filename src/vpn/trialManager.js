const fs = require('fs');
const path = require('path');
const xuiClient = require('./xuiClient');

const DATA_DIR = path.join(__dirname, '../../data');
const TRIALS_FILE = path.join(DATA_DIR, 'trials.json');

const TRIAL_CONFIG = {
  inboundId: parseInt(process.env.TRIAL_INBOUND_ID) || 1,
  expiryDays: parseInt(process.env.TRIAL_EXPIRY_DAYS) || 10,
  totalGB: parseInt(process.env.TRIAL_DATA_GB) || 100,
  ipLimit: parseInt(process.env.TRIAL_IP_LIMIT) || 1,
  maxTrials: parseInt(process.env.TRIAL_MAX_PER_USER) || 1,
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TRIALS_FILE)) {
    fs.writeFileSync(TRIALS_FILE, JSON.stringify({ trials: {} }, null, 2));
  }
}

function loadTrials() {
  ensureFile();
  return JSON.parse(fs.readFileSync(TRIALS_FILE, 'utf8'));
}

function saveTrials(data) {
  ensureFile();
  fs.writeFileSync(TRIALS_FILE, JSON.stringify(data, null, 2));
}

function hasUsedTrial(userId) {
  const data = loadTrials();
  const id = String(userId);
  if (!data.trials[id]) return false;
  return data.trials[id].count >= TRIAL_CONFIG.maxTrials;
}

function getTrialInfo(userId) {
  const data = loadTrials();
  return data.trials[String(userId)] || null;
}

function recordTrial(userId, trialData) {
  const data = loadTrials();
  const id = String(userId);

  if (!data.trials[id]) {
    data.trials[id] = { count: 0, keys: [] };
  }

  data.trials[id].count += 1;
  data.trials[id].keys.push({
    ...trialData,
    createdAt: new Date().toISOString(),
  });

  saveTrials(data);
}

async function createTrialKey(userId, username) {
  if (hasUsedTrial(userId)) {
    return { success: false, msg: 'Trial key ကို တစ်ကြိမ်သာ ထုတ်ခွင့်ရှိပါတယ်။' };
  }

  try {
    // Get inbound first to check protocol
    const inbound = await xuiClient.getInbound(TRIAL_CONFIG.inboundId);
    if (!inbound) {
      return { success: false, msg: 'Inbound not found' };
    }

    const email = `trial_${userId}_${Date.now()}`;

    const clientConfig = xuiClient.createClientConfig(email, {
      expiryDays: TRIAL_CONFIG.expiryDays,
      totalGB: TRIAL_CONFIG.totalGB * 1024 * 1024 * 1024,
      limitIp: TRIAL_CONFIG.ipLimit,
      tgId: String(userId),
      protocol: inbound.protocol,
    });

    const res = await xuiClient.addClient(TRIAL_CONFIG.inboundId, clientConfig);

    if (!res.success) {
      return { success: false, msg: res.msg || 'Failed to create trial key' };
    }

    const serverHost = process.env.XUI_SERVER_HOST || '178.128.80.123';
    const link = xuiClient.generateLink(inbound, clientConfig, serverHost);

    const expiryDate = new Date(Date.now() + TRIAL_CONFIG.expiryDays * 24 * 60 * 60 * 1000);

    const trialData = {
      email,
      uuid: clientConfig.id,
      link,
      expiryDate: expiryDate.toISOString(),
      dataGB: TRIAL_CONFIG.totalGB,
      ipLimit: TRIAL_CONFIG.ipLimit,
    };

    recordTrial(userId, trialData);

    return {
      success: true,
      data: trialData,
    };
  } catch (err) {
    return { success: false, msg: err.message };
  }
}

function getTrialConfig() {
  return TRIAL_CONFIG;
}

module.exports = {
  hasUsedTrial,
  getTrialInfo,
  createTrialKey,
  getTrialConfig,
};
