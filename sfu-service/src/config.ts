export const config = {
  port: Number(process.env.SFU_PORT) || 4000,
  announcedIp: process.env.SFU_ANNOUNCED_IP || '127.0.0.1',
  listenIp: process.env.SFU_LISTEN_IP || '0.0.0.0',
  mediaPorts: {
    min: Number(process.env.SFU_MEDIA_PORT_MIN) || 40000,
    max: Number(process.env.SFU_MEDIA_PORT_MAX) || 49999,
  },
  worker: {
    logLevel: (process.env.SFU_WORKER_LOG_LEVEL || 'warn') as 'debug' | 'warn' | 'error' | 'none',
    logTags: (process.env.SFU_WORKER_LOG_TAGS || 'info,ice,dtls,rtp,srtp,rtcp') as any,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio' as const,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.SFU_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.SFU_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    initialAvailableOutgoingBitrate: 1_000_000,
    maxSendMessageSize: 262_144,
    maxIncomingBitrate: 1_500_000,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  jwtSecret: process.env.JWT_SECRET || '',
  internalApiKey: process.env.INTERNAL_API_KEY || '',
};
