const axios = require('axios');

async function debugDisplayName() {
  try {
    console.log('[DEBUG] Testing displayName processing...');
    
    const testUserId = '37f16373-6a9c-44b0-9a7c-e95abc28092b';
    
    const response = await axios.get(`http://localhost:3003/conversations`, {
      params: { page: 1, limit: 1 },
      headers: { 'x-user-id': testUserId }
    });
    
    console.log('[DEBUG] Raw response:', JSON.stringify(response.data, null, 2));
    
    // Check if members have displayName
    response.data.data.forEach(conversation => {
      console.log(`\n[DEBUG] Conversation ID: ${conversation.id}`);
      if (conversation.members && Array.isArray(conversation.members)) {
        conversation.members.forEach(member => {
          console.log(`[DEBUG] Member: ${JSON.stringify(member, null, 2)}`);
          console.log(`[DEBUG] displayName exists: ${member.displayName !== undefined}`);
          console.log(`[DEBUG] displayName value: ${member.displayName}`);
        });
      }
    });
    
  } catch (error) {
    console.log('[DEBUG] Error:', error.message);
  }
}

debugDisplayName();
