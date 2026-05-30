import axios from 'axios';
import { config } from '../config';
import * as chatDb from './chat-db';
import { ChatbotMessage } from './chatbot-message.entity';

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_recent_chats',
        description: 'Get a list of recently sent chat messages, including sender names, message content, and timestamps.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'INTEGER', description: 'Max number of messages to return (default 5, max 20).' }
          }
        }
      },
      {
        name: 'get_top_chatters',
        description: 'Get the list of top active chat users with the highest sent messages count.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'INTEGER', description: 'Max top chatters to return (default 5).' }
          }
        }
      },
      {
        name: 'get_system_stats',
        description: 'Get general statistics including total registered users, total messages sent, and active conversation rooms.',
        parameters: { type: 'OBJECT' }
      },
      {
        name: 'get_user_info',
        description: 'Search and find information/profile of a specific user by name, username, or email.',
        parameters: {
          type: 'OBJECT',
          properties: {
            searchQuery: { type: 'STRING', description: 'The display name, username, or email of the user to search for.' }
          },
          required: ['searchQuery']
        }
      },
      {
        name: 'get_active_groups',
        description: 'List the most active chat groups ordered by their total member count.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'INTEGER', description: 'Max number of groups to return (default 5).' }
          }
        }
      },
      {
        name: 'get_most_pinned_messages',
        description: 'Retrieve recently pinned messages across all conversation rooms.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'INTEGER', description: 'Max number of pinned messages to return (default 5).' }
          }
        }
      },
      {
        name: 'get_top_reaction_emojis',
        description: 'Get the most frequently used emojis for message reactions across the chat platform.',
        parameters: { type: 'OBJECT' }
      },
      {
        name: 'create_cloud_file',
        description: 'Upload / create a new simulated file inside the users personal cloud storage.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the file (e.g. docs.pdf, image.png).' },
            url: { type: 'STRING', description: 'Web URL of the file.' },
            mimeType: { type: 'STRING', description: 'File MIME type (e.g. application/pdf, image/png).' },
            size: { type: 'INTEGER', description: 'Size of the file in bytes.' },
            folderId: { type: 'STRING', description: 'Optional parent folder UUID.' }
          },
          required: ['name', 'url', 'mimeType', 'size']
        }
      },
      {
        name: 'delete_cloud_file',
        description: 'Delete a specific file from the users personal cloud. Can delete by file name (partial match supported). If there are multiple files with similar names, optionally specify the folder name to narrow down.',
        parameters: {
          type: 'OBJECT',
          properties: {
            fileName: { type: 'STRING', description: 'The name (or partial name) of the file to delete, e.g. "QLDA_CK_v1".' },
            folderName: { type: 'STRING', description: 'Optional folder name to scope the search if multiple files have similar names.' },
            fileId: { type: 'STRING', description: 'The UUID of the file to delete (only if the user already provided it).' }
          },
          required: ['fileName']
        }
      },
      {
        name: 'list_cloud_files',
        description: 'List all files in the users personal cloud storage. Optionally filter by folder name.',
        parameters: {
          type: 'OBJECT',
          properties: {
            folderName: { type: 'STRING', description: 'Optional folder name to filter files by.' }
          }
        }
      },
      {
        name: 'list_friends',
        description: 'Retrieve the list of friends for the current user.',
        parameters: { type: 'OBJECT' }
      },
      {
        name: 'add_friend',
        description: 'Send a friend request to a user by matching their email, username, or display name.',
        parameters: {
          type: 'OBJECT',
          properties: {
            searchCriteria: { type: 'STRING', description: 'The email, username, or name of the user to send request to.' }
          },
          required: ['searchCriteria']
        }
      },
      {
        name: 'remove_friend',
        description: 'Remove/unfriend a user from the friend list by their user UUID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            friendId: { type: 'STRING', description: 'The UUID of the friend to remove.' }
          },
          required: ['friendId']
        }
      },
      {
        name: 'switch_tab',
        description: 'Navigate / switch the user interface sidebar tab on behalf of the user.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tabName: {
              type: 'STRING',
              description: 'The sidebar tab key to switch to. Must be one of: "chat" | "contact" | "cloud" | "settings".'
            }
          },
          required: ['tabName']
        }
      }
    ]
  }
];

export interface GeminiResponse {
  text: string;
  metadata?: string | null;
}

export async function askGemini(history: ChatbotMessage[], userId: string): Promise<GeminiResponse> {
  if (!config.gemini.apiKey) {
    return { text: 'AI service is not configured. Please set GEMINI_API_KEY in environment variables.' };
  }

  // Keep only the last 20 messages to prevent context dilution, maintain high responsiveness, and optimize API costs
  const limitedHistory = history.slice(-20);

  const contents = limitedHistory.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const url = `${config.gemini.baseUrl}/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

    const response = await axios.post(
      url,
      {
        contents,
        tools: GEMINI_TOOLS,
        systemInstruction: {
          parts: [{
            text: `You are a helpful AI assistant integrated into a chat application.
            You have access to powerful real-time database query and mutation tools. Always invoke the appropriate tool when asked about chat activity, users, statistics, groups, pinned messages, reactions, managing cloud files, or managing friend connections.
            You also have the switch_tab tool to navigate between pages (chat, contact, cloud, settings) for the user. If they ask you to navigate or open a screen, call the switch_tab tool.
            IMPORTANT RULES:
            - NEVER expose internal IDs, UUIDs, or database identifiers to the user. Always refer to files, folders, users, and other entities by their human-readable names only.
            - When deleting or managing cloud files, use the file name (and optionally folder name) instead of asking the user for an ID.
            - If delete_cloud_file returns that multiple matching files were found (requiresChoice is true), format the output beautifully and clearly for the user. List the files using bullet points, bold folder names, and appropriate emojis (e.g., 📁 for folders, 📄 for files), and provide a friendly call-to-action asking them to specify which folder they want to delete the file from. Do not show file IDs. Once they choose, invoke delete_cloud_file again with both fileName and folderName.
            - When listing files, show only the file name, type, size, and folder name. Never include the file ID in your response.
            - Respond in a friendly, concise manner in the same language the user writes in (typically Vietnamese).`,
          }],
        },
        generationConfig: { maxOutputTokens: 2048, temperature: 0.5 },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const candidate = response.data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    // Handle Tool (Function Calling)
    if (part?.functionCall) {
      const { name, args } = part.functionCall;
      console.log(`[Gemini Tool] Dynamic Agent Call: ${name} with parameters:`, args);

      let result: any = null;
      let action: any = null;

      switch (name) {
        case 'get_recent_chats':
          result = await chatDb.queryRecentChats(args.limit || 5);
          break;
        case 'get_top_chatters':
          result = await chatDb.queryTopChatters(args.limit || 5);
          break;
        case 'get_system_stats':
          result = await chatDb.querySystemStats();
          break;
        case 'get_user_info':
          result = await chatDb.queryUserInfo(args.searchQuery);
          break;
        case 'get_active_groups':
          result = await chatDb.queryActiveGroups(args.limit || 5);
          break;
        case 'get_most_pinned_messages':
          result = await chatDb.queryPinnedMessages(args.limit || 5);
          break;
        case 'get_top_reaction_emojis':
          result = await chatDb.queryTopEmojis();
          break;
        case 'create_cloud_file':
          result = await chatDb.createCloudFile(userId, args.name, args.url, args.mimeType, args.size, args.folderId);
          action = { type: 'create_cloud_file', payload: result };
          break;
        case 'delete_cloud_file':
          if (args.fileId) {
            result = await chatDb.deleteCloudFile(userId, args.fileId);
          } else {
            result = await chatDb.deleteCloudFileByName(userId, args.fileName, args.folderName || null);
          }
          action = { type: 'delete_cloud_file', payload: result };
          break;
        case 'list_cloud_files':
          result = await chatDb.listCloudFiles(userId, args.folderName || null);
          break;
        case 'list_friends':
          result = await chatDb.queryFriendsList(userId);
          break;
        case 'add_friend':
          result = await chatDb.addFriendRequest(userId, args.searchCriteria);
          action = { type: 'add_friend', payload: result };
          break;
        case 'remove_friend':
          result = await chatDb.removeFriendConnection(userId, args.friendId);
          action = { type: 'remove_friend', payload: args.friendId };
          break;
        case 'switch_tab':
          result = { success: true, switchedTo: args.tabName };
          action = { type: 'switch_tab', payload: args.tabName };
          break;
        default:
          throw new Error(`Unknown tool requested: ${name}`);
      }

      // V2 Second phase callback to Gemini
      const finalContents = [
        ...contents,
        candidate.content,
        {
          role: 'tool',
          parts: [{
            functionResponse: { name, response: { result } }
          }]
        }
      ];

      const finalResponse = await axios.post(
        url,
        {
          contents: finalContents,
          tools: GEMINI_TOOLS,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.5 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );

      const finalReply = finalResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || 'I executed the action but failed to generate a response.';
      return {
        text: finalReply,
        metadata: action ? JSON.stringify(action) : null
      };
    }

    return {
      text: part?.text || 'I am sorry, I was unable to generate a response.',
      metadata: null
    };
  } catch (error: any) {
    console.error('[Gemini Service] Agentic Error:', error?.response?.data || error?.message);
    return {
      text: 'Hiện tại chức năng AI đang quá tải hoặc gặp sự cố kết nối. Xin bạn vui lòng thử lại sau giây lát nhé!',
      metadata: null
    };
  }
}
