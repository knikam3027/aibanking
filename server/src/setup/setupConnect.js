/**
 * AWS Connect Setup Script
 * Run this after adding AmazonConnect_FullAccess policy to your IAM user.
 * It will auto-discover the instance, claim a phone number, and create the contact flow.
 *
 * Usage: node src/setup/setupConnect.js
 */
require('dotenv').config();
const {
  ConnectClient,
  ListInstancesCommand,
  ListPhoneNumbersV2Command,
  ListContactFlowsCommand,
  CreateContactFlowCommand,
  SearchAvailablePhoneNumbersCommand,
  ClaimPhoneNumberCommand,
} = require('@aws-sdk/client-connect');
const fs = require('fs');
const path = require('path');

const client = new ConnectClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const CONTACT_FLOW_CONTENT = JSON.stringify({
  Version: '2019-10-30',
  StartAction: 'play-greeting',
  Actions: [
    {
      Identifier: 'play-greeting',
      Type: 'MessageParticipant',
      Parameters: {
        Text: 'Hello. This is AI Banking security verification. You recently completed a high value transfer. Press 1 to confirm this was you. Press 2 if this transaction is suspicious.',
      },
      Transitions: { NextAction: 'get-input' },
    },
    {
      Identifier: 'get-input',
      Type: 'GetParticipantInput',
      Parameters: {
        InputTimeLimitSeconds: '15',
        DTMFConfiguration: {
          InputTerminationSequence: '#',
          DisableBuiltInInputProcessing: false,
        },
      },
      Transitions: {
        Conditions: [
          { NextAction: 'set-confirmed', Condition: { Operator: 'Equals', Operands: ['1'] } },
          { NextAction: 'set-suspicious', Condition: { Operator: 'Equals', Operands: ['2'] } },
        ],
        DefaultTransition: { NextAction: 'set-no-response' },
        Errors: [
          { NextAction: 'set-no-response', ErrorType: 'InputTimeLimitExceeded' },
          { NextAction: 'set-no-response', ErrorType: 'NoMatchingCondition' },
        ],
      },
    },
    {
      Identifier: 'set-confirmed',
      Type: 'UpdateContactAttributes',
      Parameters: { Attributes: { verification_result: 'confirmed' } },
      Transitions: { NextAction: 'msg-confirmed' },
    },
    {
      Identifier: 'msg-confirmed',
      Type: 'MessageParticipant',
      Parameters: { Text: 'Thank you. Your transfer has been verified successfully. Goodbye.' },
      Transitions: { NextAction: 'disconnect' },
    },
    {
      Identifier: 'set-suspicious',
      Type: 'UpdateContactAttributes',
      Parameters: { Attributes: { verification_result: 'suspicious' } },
      Transitions: { NextAction: 'msg-suspicious' },
    },
    {
      Identifier: 'msg-suspicious',
      Type: 'MessageParticipant',
      Parameters: {
        Text: 'Thank you for reporting. Your account will be temporarily held for security review. Our admin team will contact you shortly. Goodbye.',
      },
      Transitions: { NextAction: 'disconnect' },
    },
    {
      Identifier: 'set-no-response',
      Type: 'UpdateContactAttributes',
      Parameters: { Attributes: { verification_result: 'no_response' } },
      Transitions: { NextAction: 'msg-no-response' },
    },
    {
      Identifier: 'msg-no-response',
      Type: 'MessageParticipant',
      Parameters: {
        Text: 'We did not receive your input. For your safety, the transaction will be reviewed. Goodbye.',
      },
      Transitions: { NextAction: 'disconnect' },
    },
    {
      Identifier: 'disconnect',
      Type: 'DisconnectParticipant',
      Parameters: {},
      Transitions: {},
    },
  ],
});

async function setup() {
  console.log('=== AWS Connect Setup ===\n');

  // Step 1: Find instance
  console.log('1. Finding Connect instance...');
  const instances = await client.send(new ListInstancesCommand({}));
  if (!instances.InstanceSummaryList?.length) {
    console.error('No Connect instances found! Create one at https://console.aws.amazon.com/connect');
    return;
  }

  const instance = instances.InstanceSummaryList.find(i => i.InstanceAlias === 'cbamoon') || instances.InstanceSummaryList[0];
  const instanceId = instance.Id;
  console.log(`   Found: ${instance.InstanceAlias} (${instanceId})`);

  // Step 2: Check phone numbers
  console.log('\n2. Checking phone numbers...');
  const phones = await client.send(new ListPhoneNumbersV2Command({ TargetArn: instance.Arn }));

  let phoneNumber;
  if (phones.ListPhoneNumbersSummaryList?.length) {
    phoneNumber = phones.ListPhoneNumbersSummaryList[0].PhoneNumber;
    console.log(`   Found: ${phoneNumber}`);
  } else {
    console.log('   No phone numbers claimed. Searching for available numbers...');
    try {
      const available = await client.send(new SearchAvailablePhoneNumbersCommand({
        TargetArn: instance.Arn,
        PhoneNumberType: 'DID',
        PhoneNumberCountryCode: 'US',
        MaxResults: 1,
      }));

      if (available.AvailableNumbersList?.length) {
        const num = available.AvailableNumbersList[0];
        console.log(`   Claiming: ${num.PhoneNumber}...`);
        const claimed = await client.send(new ClaimPhoneNumberCommand({
          TargetArn: instance.Arn,
          PhoneNumber: num.PhoneNumber,
        }));
        phoneNumber = num.PhoneNumber;
        console.log(`   Claimed: ${phoneNumber}`);
      } else {
        console.error('   No numbers available. Claim one manually in the Connect console.');
      }
    } catch (err) {
      console.error('   Could not claim number:', err.message);
      console.log('   Please claim a phone number manually in the Connect console.');
    }
  }

  // Step 3: Create or find contact flow
  console.log('\n3. Setting up contact flow...');
  const flows = await client.send(new ListContactFlowsCommand({
    InstanceId: instanceId,
    ContactFlowTypes: ['CONTACT_FLOW'],
  }));

  let contactFlowId;
  const existingFlow = flows.ContactFlowSummaryList?.find(f => f.Name === 'AI Banking Verification');

  if (existingFlow) {
    contactFlowId = existingFlow.Id;
    console.log(`   Found existing: ${existingFlow.Name} (${contactFlowId})`);
  } else {
    try {
      const created = await client.send(new CreateContactFlowCommand({
        InstanceId: instanceId,
        Name: 'AI Banking Verification',
        Description: 'Post-transfer voice verification for high-value transactions (>1 Lakh)',
        Type: 'CONTACT_FLOW',
        Content: CONTACT_FLOW_CONTENT,
      }));
      contactFlowId = created.ContactFlowId;
      console.log(`   Created: AI Banking Verification (${contactFlowId})`);
    } catch (err) {
      console.error('   Failed to create flow:', err.message);
      console.log('   Create it manually in the Connect console.');
    }
  }

  // Step 4: Update .env
  console.log('\n4. Updating .env file...');
  const envPath = path.join(__dirname, '../../.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  if (instanceId) envContent = envContent.replace(/AWS_CONNECT_INSTANCE_ID=.*/, `AWS_CONNECT_INSTANCE_ID=${instanceId}`);
  if (contactFlowId) envContent = envContent.replace(/AWS_CONNECT_CONTACT_FLOW_ID=.*/, `AWS_CONNECT_CONTACT_FLOW_ID=${contactFlowId}`);
  if (phoneNumber) envContent = envContent.replace(/AWS_CONNECT_PHONE_NUMBER=.*/, `AWS_CONNECT_PHONE_NUMBER=${phoneNumber}`);

  fs.writeFileSync(envPath, envContent);
  console.log('   .env updated successfully!');

  // Summary
  console.log('\n=== Setup Complete ===');
  console.log(`Instance ID:     ${instanceId || '❌ NOT SET'}`);
  console.log(`Contact Flow ID: ${contactFlowId || '❌ NOT SET'}`);
  console.log(`Phone Number:    ${phoneNumber || '❌ NOT SET'}`);
  console.log('\nRestart your server for changes to take effect.');
}

setup().catch(err => {
  console.error('\nSetup failed:', err.message);
  console.log('\nMake sure your IAM user has AmazonConnect_FullAccess policy.');
  console.log('Add it at: https://console.aws.amazon.com/iam → Users → Users → Permissions → Add permissions');
});
