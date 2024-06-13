import { getRandom as getRandomUA } from 'random-useragent'
import { isbot } from 'isbot'
import { CookieAccessInfo, CookieJar } from 'cookiejar'
import { encryptString } from './des'
import { SWAGGER_HTML } from './constants'
import { ErrorResponseSchema, OPENAPI_DEFINITIONS, RequestSchema, SuccessResponseSchema } from './types'

const DLUT_PORTAL_ENDPOINT = 'https://portal.dlut.edu.cn/tp/'
const DLUT_SSO_ENDPOINT = `https://sso.dlut.edu.cn/cas/login?service=${encodeURIComponent(DLUT_PORTAL_ENDPOINT)}`

function errorResponse(message: string, status?: number) {
  return Response.json(ErrorResponseSchema.parse({ error: message }), { status: status ?? 400 })
}

interface FetchCookieOptions {
  userAgent?: string
}

async function initialFetch(userAgent: string, username: string) {
  const headers = new Headers()
  headers.set('User-Agent', userAgent)
  const request = new Request(DLUT_SSO_ENDPOINT, { headers })
  const response = await fetch(request)
  const text = await response.text()
  const setCookies = response.headers.getSetCookie().concat([
    'cas_hash=',
    `dlut_cas_un=${username}`,
  ])
  const cookies = new CookieJar()
  cookies.setCookies(setCookies)
  const lt = text.match(/name="lt" value="(.+?)"/)?.[1]
  const urlSuffix = text.match(/action="(.+?)"/)?.[1]
  const execution = text.match(/name="execution" value="(.+?)"/)?.[1]
  return {
    lt,
    execution,
    cookies,
    urlSuffix,
  }
}

function buildFormData(username: string, password: string, lt: string, execution: string) {
  const fakeRSA = encryptString(username + password + lt, ['1', '2', '3'])
  return new URLSearchParams({
    rsa: fakeRSA,
    ul: username.length.toString(),
    pl: password.length.toString(),
    sl: '0',
    lt,
    execution,
    _eventId: 'submit',
  }).toString()
}

function buildHeaders(userAgent: string, cookies: CookieJar) {
  const url = new URL(DLUT_SSO_ENDPOINT)
  return {
    'User-Agent': userAgent,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Cookie': cookies.getCookies(new CookieAccessInfo(
      url.hostname,
      url.pathname,
    )).map(cookie => cookie.toValueString()).join('; '),
    'Origin': url.origin,
    'Referer': url.href,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
  }
}

function updateHeaders(
  previousUrl: string,
  location: string,
  cookies: CookieJar,
): Record<string, string> {
  const previousUrlObject = new URL(previousUrl)
  const locationUrl = new URL(location)
  return {
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Origin': previousUrlObject.origin,
    'Referer': previousUrl,
    'Cookie': cookies.getCookies(new CookieAccessInfo(
      locationUrl.hostname,
      locationUrl.pathname,
    )).map(cookie => cookie.toValueString()).join('; '),
  }
}

async function handleRedirect(response: Response, cookies: CookieJar) {
  const location = response.headers.get('Location')
  if (!location) {
    return response
  }
  const setCookies = response.headers.getSetCookie()
  cookies.setCookies(setCookies)
  const headers = updateHeaders(response.url, location, cookies)
  const request = new Request(location, {
    headers,
    redirect: 'manual',
  })
  return handleRedirect(await fetch(request), cookies)
}

async function handleError(url: string, text: string) {
  if (text.search('span id="errormsghide"') !== -1) {
    return errorResponse('Invalid username or password', 401)
  }
  if (text.search('抱歉！您的请求出现了异常，请稍后再试。') !== -1) {
    return errorResponse('Server rejected your request, try again later.', 400)
  }
  console.warn('Failed to login with unknown error: ', {
    url,
    text,
  })
  return errorResponse('Unknown error', 500)
}

async function fetchCookie(username: string, password: string, options?: FetchCookieOptions) {
  const ua = options?.userAgent ?? getRandomUA()
  const { lt, cookies, urlSuffix, execution } = await initialFetch(ua, username)
  if (!lt || !urlSuffix || !execution) {
    return errorResponse('Failed to fetch initial data', 500)
  }
  const formdata = buildFormData(username, password, lt, execution)
  const url = (new URL(DLUT_SSO_ENDPOINT)).origin + urlSuffix
  const headers = buildHeaders(ua, cookies)
  const loginRequest = new Request(url, {
    method: 'POST',
    body: formdata,
    headers,
    redirect: 'manual',
  })
  const loginResponse = await handleRedirect(await fetch(loginRequest), cookies)
  if (new URL(loginResponse.url).origin !== new URL(DLUT_PORTAL_ENDPOINT).origin) {
    return handleError(loginResponse.url, await loginResponse.text())
  }
  const response = SuccessResponseSchema.parse({
    status_code: loginResponse.status,
    url: loginResponse.url,
    cookies: cookies.getCookies(CookieAccessInfo.All).map(cookie => cookie.toString()),
    user_agent: ua,
  })
  return Response.json(response, { status: 200 })
}

async function validate(request: Request): Promise<{ error: Response, data: null } | { error: null, data: { username: string, password: string } }> {
  if (request.method !== 'POST') {
    return { error: errorResponse('Method must be POST', 400), data: null }
  }
  if (!request.headers.has('Content-Type')
    || request.headers.get('Content-Type') !== 'application/json') {
    return { error: errorResponse('Content-Type must be application/json', 400), data: null }
  }
  const { error, data } = RequestSchema.safeParse(await request.json())
  if (error) {
    return { error: errorResponse(error.message, 400), data: null }
  }
  return {
    error: null,
    data,
  }
}

async function passwordLogin(request: Request) {
  const { error, data } = await validate(request)
  if (error) {
    return error
  }
  const requestHeaders = request.headers
  let userAgent = requestHeaders.get('User-Agent')
  if (!userAgent || isbot(userAgent)) {
    userAgent = getRandomUA(value => !isbot(value.userAgent))!
  }
  const { username, password } = data
  try {
    const result = await fetchCookie(username, password, { userAgent })
    return result
  }
  catch (e) {
    console.error(e)
    return errorResponse('Internal Server Error', 500)
  }
}

async function openapi(_: Request) {
  return new Response(
    OPENAPI_DEFINITIONS,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

async function swagger(_: Request) {
  return new Response(
    SWAGGER_HTML,
    {
      headers: {
        'Content-Type': 'text/html',
      },
    },
  )
}

async function handler(request: Request) {
  const url = new URL(request.url)
  switch (url.pathname) {
    case '/':
      url.pathname = '/docs'
      return Response.redirect(url.toString(), 302)
    case '/password':
      return await passwordLogin(request)
    case '/openapi.json':
      return await openapi(request)
    case '/docs':
      return await swagger(request)
    default:
      return errorResponse('Not Found', 404)
  }
}

export default handler
export {
  swagger,
  openapi,
  handler,
  passwordLogin,
}
