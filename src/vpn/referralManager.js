const fs = require('fs');
const path = require('path');
const xuiClient = require('./xuiClient');

const DATA_DIR = path.join(__dirname, '../../data');
const REFERRAL_FILE = path.join(DATA_DIR, 'referrals.json');

const REFERRAL_CONFIG = {
  requiredInvites: parseInt(process.env.REFERRAL_REQUIRED) || 3,
  bonusGB: parseInt(process.env.REFERRAL_BONUS_GB) || 100,
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REFERRAL_FILE)) {
    fs.writeFileSync(REFERRAL_FILE, JSON.stringify({ referrals: {} }, null, 2));
  }
}

function loadReferrals() {
  ensureFile();
  return JSON.parse(fs.readFileSync(REFERRAL_FILE, 'utf8'));
}

function saveReferrals(data) {
  ensureFile();
  fs.writeFileSync(REFERRAL_FILE, JSON.stringify(data, null, 2));
}

function getUserReferral(userId) {
  const data = loadReferrals();
  const id = String(userId);
  if (!data.referrals[id]) {
    data.referrals[id] = {
      referralCode: `ref_${id}`,
      invitedUsers: [],
      bonusClaimed: 0,
      totalBonusGB: 0,
    };
    saveReferrals(data);
  }
  return data.referrals[id];
}

function getReferralCode(userId) {
  const ref = getUserReferral(userId);
  return ref.referralCode;
}

function recordReferral(referrerId, newUserId, newUserName) {
  const data = loadReferrals();
  const id = String(referrerId);

  if (!data.referrals[id]) {
    data.referrals[id] = {
      referralCode: `ref_${id}`,
      invitedUsers: [],
      bonusClaimed: 0,
      totalBonusGB: 0,
    };
  }

  // Check if already recorded
  if (data.referrals[id].invitedUsers.some((u) => u.userId === String(newUserId))) {
    return false;
  }

  data.referrals[id].invitedUsers.push({
    userId: String(newUserId),
    name: newUserName,
    joinedAt: new Date().toISOString(),
  });

  saveReferrals(data);
  return true;
}

function canClaimBonus(userId) {
  const ref = getUserReferral(userId);
  const totalInvites = ref.invitedUsers.length;
  const nextMilestone = (ref.bonusClaimed + 1) * REFERRAL_CONFIG.requiredInvites;
  return totalInvites >= nextMilestone;
}

async function claimReferralBonus(userId) {
  if (!canClaimBonus(userId)) {
    return { success: false, msg: 'Invite လုံလောက်မှု မရှိသေးပါ။' };
  }

  try {
    const inboundId = parseInt(process.env.TRIAL_INBOUND_ID) || 1;
    const inbound = await xuiClient.getInbound(inboundId);
    if (!inbound) return { success: false, msg: 'Inbound not found' };

    const email = `referral_${userId}_${Date.now()}`;
    const clientConfig = xuiClient.createClientConfig(email, {
      expiryDays: 30,
      totalGB: REFERRAL_CONFIG.bonusGB * 1024 * 1024 * 1024,
      limitIp: 1,
      tgId: String(userId),
      protocol: inbound.protocol,
    });

    const res = await xuiClient.addClient(inboundId, clientConfig);
    if (!res.success) return { success: false, msg: res.msg || 'Failed to create bonus key' };

    const serverHost = process.env.XUI_SERVER_HOST || '178.128.80.123';
    const link = xuiClient.generateLink(inbound, clientConfig, serverHost);

    // Update referral data
    const data = loadReferrals();
    const id = String(userId);
    data.referrals[id].bonusClaimed += 1;
    data.referrals[id].totalBonusGB += REFERRAL_CONFIG.bonusGB;
    saveReferrals(data);

    return {
      success: true,
      link,
      bonusGB: REFERRAL_CONFIG.bonusGB,
      email,
    };
  } catch (err) {
    return { success: false, msg: err.message };
  }
}

function findReferrerByCode(code) {
  const data = loadReferrals();
  for (const userId of Object.keys(data.referrals)) {
    if (data.referrals[userId].referralCode === code) {
      return userId;
    }
  }
  return null;
}

function getReferralConfig() {
  return REFERRAL_CONFIG;
}

module.exports = {
  getUserReferral,
  getReferralCode,
  recordReferral,
  canClaimBonus,
  claimReferralBonus,
  findReferrerByCode,
  getReferralConfig,
};
