-- Sample data for chat-service testing

-- Insert sample conversations
INSERT INTO conversations (id, type, title, created_by, direct_key, last_message_id, last_message_preview, last_message_at, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'GROUP', 'Project Discussion', 'user001', NULL, NULL, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'GROUP', 'Team Updates', 'user002', NULL, NULL, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'DIRECT', NULL, 'user001', 'user001_user003', NULL, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', 'GROUP', 'General Chat', 'user001', NULL, NULL, NULL, NULL, NOW(), NOW());

-- Insert sample conversation members (with role, is_muted)
INSERT INTO conversation_members (conversation_id, user_id, joined_at, role, is_muted) VALUES
-- Project Discussion (user001 là admin)
('550e8400-e29b-41d4-a716-446655440001', 'user001', NOW(), 'admin', false),
('550e8400-e29b-41d4-a716-446655440001', 'user002', NOW(), 'member', false),
('550e8400-e29b-41d4-a716-446655440001', 'user003', NOW(), 'member', true), -- user003 muted
-- Team Updates (user002 là admin)
('550e8400-e29b-41d4-a716-446655440002', 'user002', NOW(), 'admin', false),
('550e8400-e29b-41d4-a716-446655440002', 'user004', NOW(), 'member', false),
-- Direct chat (không có role, đều là member)
('550e8400-e29b-41d4-a716-446655440003', 'user001', NOW(), 'member', false),
('550e8400-e29b-41d4-a716-446655440003', 'user003', NOW(), 'member', false),
-- General Chat (user001 là admin)
('550e8400-e29b-41d4-a716-446655440004', 'user001', NOW(), 'admin', false),
('550e8400-e29b-41d4-a716-446655440004', 'user002', NOW(), 'member', false),
('550e8400-e29b-41d4-a716-446655440004', 'user003', NOW(), 'member', false),
('550e8400-e29b-41d4-a716-446655440004', 'user004', NOW(), 'member', true), -- user004 muted
('550e8400-e29b-41d4-a716-446655440004', 'user005', NOW(), 'member', false);

-- Insert sample messages (with reply_to_message_id, is_deleted, edited_at, metadata)
INSERT INTO messages (id, conversation_id, sender_id, content_type, content, reply_to_message_id, is_deleted, edited_at, metadata, created_at) VALUES
-- Project Discussion
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'user001', 'TEXT', 'Hello everyone! Let''s discuss the project timeline.', NULL, false, NULL, NULL, NOW() - INTERVAL '2 hours'),
('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'user002', 'TEXT', 'Sure, I have some updates to share.', NULL, false, NULL, NULL, NOW() - INTERVAL '1 hour 50 minutes'),
-- Tin nhắn reply đến 550e8400-e29b-41d4-a716-446655440011
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'user003', 'TEXT', 'Great! I''ll prepare the documentation.', '550e8400-e29b-41d4-a716-446655440011', false, NULL, NULL, NOW() - INTERVAL '1 hour 30 minutes'),
-- Tin nhắn đã edited
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', 'user001', 'TEXT', 'Deadline is next Friday (updated)', NULL, false, NOW() - INTERVAL '1 hour', NULL, NOW() - INTERVAL '1 hour 15 minutes'),
-- Tin nhắn đã deleted (soft delete)
('550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440001', 'user002', 'TEXT', 'This message was deleted', NULL, true, NULL, NULL, NOW() - INTERVAL '1 hour'),

-- Team Updates
('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440002', 'user002', 'TEXT', 'Team meeting scheduled for tomorrow at 10 AM.', NULL, false, NULL, NULL, NOW() - INTERVAL '3 hours'),
('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440002', 'user004', 'TEXT', 'I''ll attend the meeting.', '550e8400-e29b-41d4-a716-446655440021', false, NULL, NULL, NOW() - INTERVAL '2 hours 50 minutes'),

-- Direct chat
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440003', 'user001', 'TEXT', 'Hey! How are you doing?', NULL, false, NULL, NULL, NOW() - INTERVAL '5 hours'),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440003', 'user003', 'TEXT', 'I''m doing great! Thanks for asking.', '550e8400-e29b-41d4-a716-446655440031', false, NULL, NULL, NOW() - INTERVAL '4 hours 50 minutes'),

-- General Chat
('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440004', 'user001', 'TEXT', 'Welcome to the general chat!', NULL, false, NULL, NULL, NOW() - INTERVAL '1 day'),
('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440004', 'user002', 'TEXT', 'Thanks! Happy to be here.', '550e8400-e29b-41d4-a716-446655440041', false, NULL, NULL, NOW() - INTERVAL '23 hours'),
('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440004', 'user003', 'TEXT', 'Looking forward to collaborating with everyone.', NULL, false, NULL, NULL, NOW() - INTERVAL '22 hours'),
('550e8400-e29b-41d4-a716-446655440044', '550e8400-e29b-41d4-a716-446655440004', 'user004', 'TEXT', 'This is going to be awesome!', NULL, false, NULL, NULL, NOW() - INTERVAL '21 hours'),
('550e8400-e29b-41d4-a716-446655440045', '550e8400-e29b-41d4-a716-446655440004', 'user005', 'TEXT', 'Hello team! 👋', NULL, false, NULL, NULL, NOW() - INTERVAL '20 hours'),
-- Tin nhắn với metadata (file)
('550e8400-e29b-41d4-a716-446655440046', '550e8400-e29b-41d4-a716-446655440004', 'user001', 'IMAGE', 'https://example.com/image.jpg', NULL, false, NULL, '{"fileName": "screenshot.jpg", "fileSize": 1024000, "width": 1920, "height": 1080}', NOW() - INTERVAL '19 hours');

-- Update conversations with last message info
-- Conversation 1: tin nhắn edited (550e8400-e29b-41d4-a716-446655440014) là mới nhất không bị deleted
UPDATE conversations SET
  last_message_id = '550e8400-e29b-41d4-a716-446655440014',
  last_message_preview = 'Deadline is next Friday (updated)',
  last_message_at = (SELECT created_at FROM messages WHERE id = '550e8400-e29b-41d4-a716-446655440014'),
  updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

UPDATE conversations SET
  last_message_id = '550e8400-e29b-41d4-a716-446655440022',
  last_message_preview = 'I''ll attend the meeting.',
  last_message_at = (SELECT created_at FROM messages WHERE id = '550e8400-e29b-41d4-a716-446655440022'),
  updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440002';

UPDATE conversations SET
  last_message_id = '550e8400-e29b-41d4-a716-446655440032',
  last_message_preview = 'I''m doing great! Thanks for asking.',
  last_message_at = (SELECT created_at FROM messages WHERE id = '550e8400-e29b-41d4-a716-446655440032'),
  updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440003';

UPDATE conversations SET
  last_message_id = '550e8400-e29b-41d4-a716-446655440046',
  last_message_preview = '[Hình ảnh]',
  last_message_at = (SELECT created_at FROM messages WHERE id = '550e8400-e29b-41d4-a716-446655440046'),
  updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440004';

-- Insert sample message read receipts
-- Tin nhắn 550e8400-e29b-41d4-a716-446655440011 đã được đọc bởi user002, user003
INSERT INTO message_read_receipts (message_id, user_id, read_at) VALUES
('550e8400-e29b-41d4-a716-446655440011', 'user002', NOW() - INTERVAL '1 hour 45 minutes'),
('550e8400-e29b-41d4-a716-446655440011', 'user003', NOW() - INTERVAL '1 hour 30 minutes'),
-- Tin nhắn 550e8400-e29b-41d4-a716-446655440012 đã được đọc bởi user001, user003
('550e8400-e29b-41d4-a716-446655440012', 'user001', NOW() - INTERVAL '1 hour 40 minutes'),
('550e8400-e29b-41d4-a716-446655440012', 'user003', NOW() - INTERVAL '1 hour 25 minutes'),
-- Direct chat messages
('550e8400-e29b-41d4-a716-446655440031', 'user003', NOW() - INTERVAL '4 hours 45 minutes'),
('550e8400-e29b-41d4-a716-446655440032', 'user001', NOW() - INTERVAL '4 hours 40 minutes');
