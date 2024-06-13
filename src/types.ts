import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { OpenApiBuilder } from 'openapi3-ts/oas30'
import z from 'zod'

extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

const RequestSchema = z.object({
  username: z.string().openapi({
    description: 'The username of the user, in DLUT usually is the student ID or teacher ID, like 2024xxxxxxx',
    example: '2024xxxxxxx',
  }),
  password: z.string().openapi({
    description: 'The password of the user',
  }),
}).openapi('Request', {
  description: 'The body of the request',
})

const SuccessResponseSchema = z.object({
  status_code: z.number().openapi({
    description: 'The status code of the response',
    example: 200,
  }),
  url: z.string().openapi({
    description: 'The final URL after the login process',
    example: 'https://portal.dlut.edu.cn/tp/',
  }),
  cookies: z.array(z.string()).openapi({
    description: 'The cookies set by the server',
    example: ['JSESSIONID=xxxxxx', 'CASTGC=xxxxxx'],
  }),
  user_agent: z.string().openapi({
    description: 'The User-Agent used in the request, you may keep it for future requests',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
  }),
}).openapi('SuccessResponse', {
  description: 'The response of the fetch request',
})

const ErrorResponseSchema = z.object({
  error: z.string(),
}).openapi('ErrorResponse', {
  description: 'The error response',
})

registry.registerPath({
  method: 'post',
  path: '/password',
  description: 'Using the username and password to login to the DLUT.',
  request: {
    headers: z.object({
      'User-Agent': z.string().optional().openapi({
        description: 'The User-Agent of the request, if provided, the server may use it to identify the client, or will automatically generate one.',
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      }),
    }).openapi('RequestHeaders'),
    body: {
      content: {
        'application/json': {
          schema: RequestSchema,
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'The response of the fetch request, if the login is successful',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    '40x': {
      description: 'The error response, if the login is failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '50x': {
      description: 'The error response, if the server is failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

const generator = new OpenApiGeneratorV3(registry.definitions)

const openapi = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'DLUT SSO API',
    description: 'This API provides a API call to login to the DLUT SSO system.',
  },
  // servers: [{ url: '/pa' }],
})

const builder = new OpenApiBuilder(openapi)
const OPENAPI_DEFINITIONS = builder.getSpecAsJson()

export {
  RequestSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  OPENAPI_DEFINITIONS,
}
