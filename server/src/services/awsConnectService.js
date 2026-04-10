const { ConnectClient, StartOutboundVoiceContactCommand, DescribeContactCommand, GetContactAttributesCommand } = require('@aws-sdk/client-connect');

const client = new ConnectClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Initiate a post-transfer verification call via AWS Connect.
 * Calls the user and plays an IVR: Press 1 to confirm, Press 2 to report suspicious.
 */
async function makeVerificationCall(phoneNumber, verificationId, transferDetails) {
  try {
    const instanceId = process.env.AWS_CONNECT_INSTANCE_ID;
    const contactFlowId = process.env.AWS_CONNECT_CONTACT_FLOW_ID;
    const sourcePhone = process.env.AWS_CONNECT_PHONE_NUMBER;

    if (!instanceId || !contactFlowId || !sourcePhone) {
      console.warn('[AWS Connect] Missing config — using simulation mode');
      return { success: false, reason: 'AWS Connect not configured. Using simulation mode.' };
    }

    // Format phone to E.164
    let destPhone = phoneNumber.replace(/[\s\-()]/g, '');
    if (!destPhone.startsWith('+')) destPhone = '+91' + destPhone.replace(/^0+/, '');

    const command = new StartOutboundVoiceContactCommand({
      InstanceId: instanceId,
      ContactFlowId: contactFlowId,
      DestinationPhoneNumber: destPhone,
      SourcePhoneNumber: sourcePhone,
      Attributes: {
        verificationId: verificationId,
        amount: String(transferDetails.amount),
        receiverAccount: transferDetails.receiverAccount.slice(-4),
        beneficiaryName: transferDetails.beneficiaryName || 'Not specified',
      },
    });

    const response = await client.send(command);
    console.log(`[AWS Connect] Call initiated: ContactId=${response.ContactId}, to=${destPhone}`);

    return {
      success: true,
      contactId: response.ContactId,
    };
  } catch (error) {
    console.error('[AWS Connect] Call failed:', error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Get the verification result from a completed Connect contact.
 * Reads contact attributes set by the Contact Flow (verification_result).
 */
async function getVerificationResult(contactId) {
  try {
    const instanceId = process.env.AWS_CONNECT_INSTANCE_ID;
    if (!instanceId || !contactId) return { status: 'unknown' };

    // First check if the contact has ended
    const descResp = await client.send(new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }));

    const contact = descResp.Contact;
    const disconnectTime = contact?.DisconnectTimestamp;
    const initiationMethod = contact?.InitiationMethod;

    if (!disconnectTime) {
      // Call still in progress
      return { status: 'in_progress', contactStatus: contact?.AgentInfo ? 'connected' : 'ringing' };
    }

    // Call ended — read contact attributes for verification result
    const attrResp = await client.send(new GetContactAttributesCommand({
      InstanceId: instanceId,
      InitialContactId: contactId,
    }));

    const attrs = attrResp.Attributes || {};
    const result = attrs.verification_result || 'no_response';

    return {
      status: 'completed',
      verificationResult: result, // 'confirmed', 'suspicious', 'no_response'
      duration: disconnectTime && contact?.InitiationTimestamp
        ? Math.round((new Date(disconnectTime) - new Date(contact.InitiationTimestamp)) / 1000)
        : 0,
    };
  } catch (error) {
    console.error('[AWS Connect] Get result failed:', error.message);
    return { status: 'error', error: error.message };
  }
}

module.exports = { makeVerificationCall, getVerificationResult };
