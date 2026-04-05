const axios = require('axios');

const EXOTEL_SID = process.env.EXOTEL_SID || 'cbamoon1';
const EXOTEL_API_KEY = process.env.EXOTEL_API_KEY;
const EXOTEL_API_TOKEN = process.env.EXOTEL_API_TOKEN;
const EXOTEL_SUBDOMAIN = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
const EXOTEL_CALLER_ID = process.env.EXOTEL_CALLER_ID;

function getAuthHeader() {
  return 'Basic ' + Buffer.from(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`).toString('base64');
}

/**
 * Make a verification voice call via Exotel.
 * Uses "connect number to a call flow" API — Exotel calls the user
 * and connects them to your ExoPhone's voice app (IVR greeting).
 */
async function makeVerificationCall(phoneNumber, transferId) {
  if (!EXOTEL_API_KEY || !EXOTEL_API_TOKEN) {
    console.warn('[Exotel] API credentials not configured. Skipping real call.');
    return { success: false, reason: 'credentials_missing', callSid: null };
  }

  if (!EXOTEL_CALLER_ID) {
    console.warn('[Exotel] No ExoPhone (CallerID) configured.');
    return { success: false, reason: 'no_caller_id', callSid: null };
  }

  // Use "connect number to a call flow" API
  // This calls the user's phone and plays the ExoPhone's configured IVR
  const url = `https://${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`;

  const params = new URLSearchParams();
  params.append('From', phoneNumber);
  params.append('CallerId', EXOTEL_CALLER_ID);
  params.append('Url', `http://my.exotel.com/${EXOTEL_SID}/exoml/start_voice/1220083`);
  params.append('CallType', 'trans');
  params.append('TimeLimit', '120');
  params.append('TimeOut', '30');

  try {
    const response = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': getAuthHeader(),
      },
      timeout: 15000,
    });

    const callData = response.data?.Call || response.data;
    const callSid = callData?.Sid || null;
    console.log(`[Exotel] Call initiated. SID: ${callSid}, To: ${phoneNumber}, Status: ${callData?.Status}`);
    return { success: true, callSid, data: callData };
  } catch (error) {
    const errMsg = error.response?.data?.RestException?.Message
      || error.response?.data?.Message
      || error.message;
    console.error('[Exotel] Call failed:', error.response?.status, errMsg);
    return { success: false, reason: errMsg, callSid: null };
  }
}

/**
 * Get call status from Exotel.
 */
async function getCallStatus(callSid) {
  if (!callSid || !EXOTEL_API_KEY) return null;

  const url = `https://${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}/Calls/${callSid}.json`;

  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': getAuthHeader() },
      timeout: 10000,
    });
    const call = response.data?.Call || response.data;
    return {
      status: call?.Status,
      duration: call?.Duration,
      startTime: call?.StartTime,
      endTime: call?.EndTime,
    };
  } catch (error) {
    console.error('[Exotel] Get call status failed:', error.message);
    return null;
  }
}

/**
 * Risk assessment for a transfer.
 * Returns { level: 'low'|'medium'|'high', reason: string }
 */
function assessTransferRisk(amount, balance, recentTransactions = []) {
  // High risk conditions
  if (amount > 50000) {
    return { level: 'high', reason: `High-value transfer: ₹${amount.toLocaleString('en-IN')}` };
  }

  if (balance > 0 && amount > balance * 0.5) {
    return { level: 'high', reason: 'Transfer exceeds 50% of your balance' };
  }

  // Check for unusual frequency (more than 3 transfers in last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = recentTransactions.filter(
    t => t.type === 'debit' && new Date(t.createdAt) > oneHourAgo
  ).length;
  if (recentCount >= 3) {
    return { level: 'high', reason: 'Unusual transfer frequency detected' };
  }

  // Medium risk
  if (amount > 10000) {
    return { level: 'medium', reason: `Transfer amount: ₹${amount.toLocaleString('en-IN')}` };
  }

  return { level: 'low', reason: 'Normal transaction' };
}

module.exports = { makeVerificationCall, getCallStatus, assessTransferRisk };
