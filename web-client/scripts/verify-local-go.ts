import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { NextRequest } from 'next/server'

import { GET as getConfig } from '../app/api/get_config/route'
import { POST as startAgent } from '../app/api/v2/startAgent/route'
import { POST as stopAgent } from '../app/api/v2/stopAgent/route'

type ChildProcessHandle = {
  kill: () => void
  exited: Promise<number>
  readStderr: () => string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function getJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

function spawnProcess(cmd: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcessHandle {
  const child = spawn(cmd[0], cmd.slice(1), {
    cwd,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  })

  let stderr = ''

  child.stderr.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString()
  })

  return {
    kill: () => {
      if (!child.killed) {
        child.kill()
      }
    },
    exited: new Promise<number>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => resolve(code ?? 1))
    }),
    readStderr: () => stderr.trim(),
  }
}

async function waitForHealthyBackend(
  baseUrl: string,
  timeoutMs: number,
  readServerStderr: () => Promise<string>,
) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'backend did not start'

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/get_config?uid=4321&channel=go-smoke`)
      if (response.ok) {
        return
      }
      lastError = `backend returned ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    await sleep(250)
  }

  const stderr = await readServerStderr()
  throw new Error(`Timed out waiting for Go backend: ${lastError}${stderr ? `. Go server stderr: ${stderr}` : ''}`)
}

async function main() {
  const projectRoot = process.cwd()
  const serverRoot = path.resolve(projectRoot, '..', 'server-go')
  const fakeServerBin = path.join(tmpdir(), `fake-server-smoke-${process.pid}`)
  const port = 43140 + Math.floor(Math.random() * 20)
  const backendUrl = `http://127.0.0.1:${port}`
  const originalBackendUrl = process.env.AGENT_BACKEND_URL

  await mkdir(path.dirname(fakeServerBin), { recursive: true })

  const buildProcess = spawnProcess(
    ['go', 'build', '-o', fakeServerBin, './cmd/fake-server'],
    serverRoot,
    process.env,
  )

  const buildExitCode = await buildProcess.exited
  if (buildExitCode !== 0) {
    const stderr = buildProcess.readStderr()
    throw new Error(`Failed to build fake Go server.${stderr ? ` Go said: ${stderr}` : ''}`)
  }

  const serverProcess = spawnProcess(
    [fakeServerBin],
    serverRoot,
    {
      ...process.env,
      PORT: String(port),
    },
  )

  try {
    await waitForHealthyBackend(backendUrl, 20_000, async () => {
      return serverProcess.readStderr()
    })

    process.env.AGENT_BACKEND_URL = backendUrl

    const configResponse = await getConfig(
      new NextRequest('http://localhost:3000/api/get_config?uid=4321&channel=go-smoke'),
    )
    const configBody = await getJson(configResponse)
    assert(configResponse.status === 200, 'GET /api/get_config should proxy to the real Go backend')
    assert(configBody.code === 0, 'GET /api/get_config should preserve the Go backend success payload')

    const data = configBody.data as Record<string, unknown> | undefined
    assert(data?.uid === '4321', 'GET /api/get_config should preserve the requested uid through the Go backend')
    assert(data?.channel_name === 'go-smoke', 'GET /api/get_config should preserve the requested channel through the Go backend')
    assert(data?.token === 'fake-token', 'GET /api/get_config should return the token from the Go backend')
    assert(data?.agent_uid === '9999', 'GET /api/get_config should return the agent uid from the Go backend')

    const startResponse = await startAgent(
      new NextRequest('http://localhost:3000/api/v2/startAgent', {
        method: 'POST',
        body: JSON.stringify({
          channelName: 'go-smoke',
          rtcUid: 9999,
          userUid: 4321,
        }),
      }),
    )
    const startBody = await getJson(startResponse)
    assert(startResponse.status === 200, 'POST /api/v2/startAgent should proxy to the real Go backend')
    assert(startBody.code === 0, 'POST /api/v2/startAgent should preserve the Go backend success payload')
    assert(
      (startBody.data as Record<string, unknown> | undefined)?.agent_id === 'fake-agent-9999',
      'POST /api/v2/startAgent should return the agent id from the Go backend',
    )

    const stopResponse = await stopAgent(
      new NextRequest('http://localhost:3000/api/v2/stopAgent', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'fake-agent-9999' }),
      }),
    )
    const stopBody = await getJson(stopResponse)
    assert(stopResponse.status === 200, 'POST /api/v2/stopAgent should proxy to the real Go backend')
    assert(stopBody.code === 0, 'POST /api/v2/stopAgent should preserve the Go backend success payload')

    console.log('Local Go proxy smoke check passed')
  } finally {
    if (originalBackendUrl) {
      process.env.AGENT_BACKEND_URL = originalBackendUrl
    } else {
      delete process.env.AGENT_BACKEND_URL
    }

    serverProcess.kill()
    await serverProcess.exited
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
