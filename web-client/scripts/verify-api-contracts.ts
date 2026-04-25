import { NextRequest } from 'next/server'
import { RtcTokenBuilder } from 'agora-token'

import { GET as getConfig } from '../app/api/get_config/route'
import { POST as startAgent } from '../app/api/v2/startAgent/route'
import { POST as stopAgent } from '../app/api/v2/stopAgent/route'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function getJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

async function verifyGetConfigRoute() {
  process.env.AGORA_APP_ID = '0123456789abcdef0123456789abcdef'
  process.env.AGORA_APP_CERTIFICATE = 'fedcba9876543210fedcba9876543210'
  delete process.env.AGENT_BACKEND_URL

  const originalBuildTokenWithRtm = RtcTokenBuilder.buildTokenWithRtm
  let tokenBuilderArgs: unknown[] | null = null

  RtcTokenBuilder.buildTokenWithRtm = ((...args: unknown[]) => {
    tokenBuilderArgs = args
    return 'mock-rtc-rtm-token'
  }) as typeof RtcTokenBuilder.buildTokenWithRtm

  try {
    const request = new NextRequest('http://localhost:3000/api/get_config?uid=1234&channel=test-channel')
    const response = await getConfig(request)
    const body = await getJson(response)

    assert(response.status === 200, 'GET /api/get_config should return 200')
    assert(body.code === 0, 'GET /api/get_config should return code 0')

    const data = body.data as Record<string, unknown> | undefined
    assert(data, 'GET /api/get_config should include data')
    assert(data?.app_id === process.env.AGORA_APP_ID, 'GET /api/get_config should echo app_id')
    assert(data?.uid === '1234', 'GET /api/get_config should preserve uid')
    assert(data?.channel_name === 'test-channel', 'GET /api/get_config should preserve channel_name')
    assert(data?.token === 'mock-rtc-rtm-token', 'GET /api/get_config should return the RTC+RTM token')
    assert(typeof data?.agent_uid === 'string' && data.agent_uid.length > 0, 'GET /api/get_config should return agent_uid')

    assert(Array.isArray(tokenBuilderArgs), 'GET /api/get_config should call buildTokenWithRtm')
    assert(tokenBuilderArgs?.[2] === 'test-channel', 'buildTokenWithRtm should use the requested channel')
    assert(tokenBuilderArgs?.[3] === 1234, 'buildTokenWithRtm should receive an int uid')
  } finally {
    RtcTokenBuilder.buildTokenWithRtm = originalBuildTokenWithRtm
  }
}

async function verifyStartAgentValidation() {
  delete process.env.AGENT_BACKEND_URL

  const request = new NextRequest('http://localhost:3000/api/v2/startAgent', {
    body: JSON.stringify({ channelName: 'missing-uids' }),
    method: 'POST',
  })
  const response = await startAgent(request)
  const body = await getJson(response)

  assert(response.status === 400, 'POST /api/v2/startAgent should reject missing fields')
  assert(body.detail === 'channelName, rtcUid, and userUid are required', 'POST /api/v2/startAgent should explain validation failure')
}

async function verifyStopAgentValidation() {
  delete process.env.AGENT_BACKEND_URL

  const request = new NextRequest('http://localhost:3000/api/v2/stopAgent', {
    body: JSON.stringify({}),
    method: 'POST',
  })
  const response = await stopAgent(request)
  const body = await getJson(response)

  assert(response.status === 400, 'POST /api/v2/stopAgent should reject missing agentId')
  assert(body.detail === 'agentId is required', 'POST /api/v2/stopAgent should explain validation failure')
}

async function main() {
  await verifyGetConfigRoute()
  await verifyStartAgentValidation()
  await verifyStopAgentValidation()
  console.log('API contract checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
